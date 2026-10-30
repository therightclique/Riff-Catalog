import { useEffect, useRef, useState } from 'react';
import { getPrefs, changePrefs, subscribePrefs } from './SettingsService';
import { getTheme, setTheme, subscribeTheme } from './Appearance';
import { playChord, guitarChordMidi, pianoChordMidi, installAudioUnlock } from './AudioEngine';
import { clearSidecarCache } from './MetadataService';
import { NOTE_ROLE_COLORS, DEFAULT_NOTE_ROLE_COLORS, NOTE_ROLE_TEXT, isValidHex } from './theme';
import { changeNoteRoleColors, resetNoteRoleColors, getSettingsStatus, subscribeSettingsStatus } from './SettingsService';

const ROLES = [
  { id: 'root', label: 'Root', badge: 'R' },
  { id: 'third', label: '3rd', badge: '3' },
  { id: 'fifth', label: '5th', badge: '5' },
  { id: 'other', label: 'Other notes', badge: '•' },
];

const COMMIT_DELAY_MS = 150; // while dragging the picker, redraw the app at most this often

const STATUS_TEXT = {
  saved: '✓ Saved — synced with your Google Drive',
  saving: 'Saving…',
  'device-only': 'Saved on this device — will sync to Google Drive when you\'re online and signed in',
};

function ColorRow({ role }) {
  const current = NOTE_ROLE_COLORS[role.id];
  const [draft, setDraft] = useState(current);   // what the picker/hex box currently show
  const [hexText, setHexText] = useState(current);
  const timer = useRef(null);
  const pending = useRef(null);

  // Follow outside changes (Reset, or colors adopted from another device).
  useEffect(() => { setDraft(current); setHexText(current); }, [current]);

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current) { changeNoteRoleColors({ [role.id]: pending.current }); pending.current = null; }
  };
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (hex) => {
    const v = hex.toLowerCase();
    setDraft(v); setHexText(v);
    pending.current = v;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, COMMIT_DELAY_MS);
  };

  const onHexType = (e) => {
    let t = e.target.value.trim();
    if (t && !t.startsWith('#')) t = '#' + t;
    setHexText(t);
    if (isValidHex(t)) choose(t);
  };

  const text = NOTE_ROLE_TEXT[role.id];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderTop: '1px solid var(--rc-line)' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0, backgroundColor: draft,
        color: isValidHex(draft) ? text : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: '700', fontSize: '16px', border: '1px solid rgba(0,0,0,0.25)' }}>
        {role.badge}
      </div>
      <div style={{ flex: 1, textAlign: 'left', fontSize: '15px', fontWeight: '600', color: 'var(--rc-ink)' }}>{role.label}</div>
      <input
        value={hexText} onChange={onHexType} onBlur={() => setHexText(draft)}
        aria-label={`${role.label} color hex code`} maxLength={7} spellCheck={false}
        autoCapitalize="off" autoCorrect="off"
        style={{ width: '88px', padding: '8px', fontSize: '14px', fontFamily: 'monospace', border: '1px solid var(--rc-line)',
          borderRadius: '6px', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)', textTransform: 'lowercase' }}
      />
      <input
        type="color" value={draft} onChange={e => choose(e.target.value)}
        aria-label={`${role.label} color picker`}
        style={{ width: '52px', height: '40px', padding: 0, border: '1px solid var(--rc-line)', borderRadius: '6px',
          backgroundColor: 'var(--rc-surface)', cursor: 'pointer', flexShrink: 0 }}
      />
    </div>
  );
}


// ── shared look ─────────────────────────────────────────────────────────

const CARD = { padding: '16px', backgroundColor: 'var(--rc-card)', borderRadius: '8px', color: 'var(--rc-ink)', marginBottom: '16px' };
const TITLE = { fontSize: '17px', fontWeight: '700', marginBottom: '4px' };
const HELP = { fontSize: '13px', color: 'var(--rc-ink2)', lineHeight: 1.4, marginBottom: '12px' };
const BTN = { padding: '8px 14px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--rc-line)', backgroundColor: 'var(--rc-surface)', color: 'var(--rc-ink)', cursor: 'pointer' };

// A row of choices where exactly one is selected.
function Segmented({ value, options, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex' }}>
      {options.map(([id, text], i) => {
        const active = value === id;
        return (
          <button key={id} role="radio" aria-checked={active} onClick={() => onChange(id)}
            style={{
              flex: 1, padding: '10px 6px', fontSize: '14px', cursor: 'pointer', fontWeight: active ? '700' : '500',
              border: '1px solid #1a73e8', backgroundColor: active ? '#1a73e8' : 'var(--rc-surface)', color: active ? '#fff' : '#1a73e8',
              borderRadius: i === 0 ? '8px 0 0 8px' : i === options.length - 1 ? '0 8px 8px 0' : 0, marginLeft: i === 0 ? 0 : '-1px',
            }}>
            {text}
          </button>
        );
      })}
    </div>
  );
}

function useSyncedPrefs() {
  const [prefs, setPrefs] = useState(getPrefs());
  useEffect(() => subscribePrefs(setPrefs), []);
  return prefs;
}

function useStatus() {
  const [status, setStatus] = useState(getSettingsStatus());
  useEffect(() => subscribeSettingsStatus(setStatus), []);
  return status;
}

// ── Strum speed ─────────────────────────────────────────────────────────

const STRUM_STEPS = [
  { label: 'Instant', value: 0.15 },
  { label: 'Quick', value: 0.5 },
  { label: 'Normal', value: 1 },
  { label: 'Slow', value: 1.6 },
  { label: 'Very slow', value: 2.4 },
];
const nearestStrumStep = (v) => STRUM_STEPS.reduce((best, s, i) => (Math.abs(s.value - v) < Math.abs(STRUM_STEPS[best].value - v) ? i : best), 0);

function StrumCard() {
  const prefs = useSyncedPrefs();
  const status = useStatus();
  const idx = nearestStrumStep(prefs.strum);
  useEffect(() => { installAudioUnlock(); }, []);

  // Plays a G chord on whichever instrument Key Finder is set to, at the speed now chosen.
  const hear = () => {
    let instrument = 'guitar';
    try { if (localStorage.getItem('rc_keyfinder_instrument') === 'piano') instrument = 'piano'; } catch { /* default */ }
    playChord(instrument, instrument === 'piano' ? pianoChordMidi('G', 'M') : guitarChordMidi({ frets: [3, 2, 0, 0, 0, 3] }));
  };
  const choose = (i) => {
    changePrefs({ strum: STRUM_STEPS[i].value });
    setTimeout(hear, 30);   // let the new speed take effect, then play it
  };

  return (
    <div style={CARD}>
      <div style={TITLE}>Strum speed</div>
      <div style={HELP}>How spread out the notes of a chord are when you tap a chord in Key Finder. Slower makes each note easier to pick out.</div>
      <input type="range" min="0" max={STRUM_STEPS.length - 1} step="1" value={idx} onChange={e => choose(Number(e.target.value))}
        aria-label="Strum speed" aria-valuetext={STRUM_STEPS[idx].label} style={{ width: '100%' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--rc-ink2)', marginTop: '2px' }}>
        {STRUM_STEPS.map((s, i) => <span key={s.label} style={{ fontWeight: i === idx ? '700' : '400', color: i === idx ? 'var(--rc-ink)' : 'var(--rc-ink2)' }}>{s.label}</span>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderTop: '1px solid var(--rc-line)', marginTop: '12px', paddingTop: '12px' }}>
        <div style={{ fontSize: '12px', color: 'var(--rc-ink2)', flex: 1 }}>{STATUS_TEXT[status]}</div>
        <button onPointerDown={e => { e.preventDefault(); hear(); }} style={{ ...BTN, flexShrink: 0 }}>▶ Hear it</button>
      </div>
    </div>
  );
}

// ── Sharps or flats ─────────────────────────────────────────────────────

function NotationCard() {
  const prefs = useSyncedPrefs();
  const status = useStatus();
  return (
    <div style={CARD}>
      <div style={TITLE}>Note names</div>
      <div style={HELP}>
        Show the black keys as sharps or as flats in every key name, chord, diagram and keyboard.
        With flats, each key is spelled the way it&rsquo;s normally written (D major keeps its F♯ and C♯; B♭ major shows B♭ and E♭).
        Your saved clips aren&rsquo;t changed.
      </div>
      <Segmented label="Note names" value={prefs.accidentals} onChange={a => changePrefs({ accidentals: a })}
        options={[['sharps', 'Sharps (C♯)'], ['flats', 'Flats (D♭)']]} />
      <div style={{ fontSize: '12px', color: 'var(--rc-ink2)', borderTop: '1px solid var(--rc-line)', marginTop: '12px', paddingTop: '12px' }}>{STATUS_TEXT[status]}</div>
    </div>
  );
}

// ── Light / dark ────────────────────────────────────────────────────────

function AppearanceCard() {
  const [theme, setT] = useState(getTheme());
  useEffect(() => subscribeTheme(setT), []);
  return (
    <div style={CARD}>
      <div style={TITLE}>Appearance</div>
      <div style={HELP}>Light, dark, or match this device&rsquo;s setting. This applies to this device only, so your phone and computer can look different.</div>
      <Segmented label="Appearance" value={theme} onChange={setTheme}
        options={[['system', 'Match device'], ['light', '☀️ Light'], ['dark', '🌙 Dark']]} />
    </div>
  );
}

// ── Account and storage ─────────────────────────────────────────────────

const formatMB = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function AccountCard({ user, signedIn, online, pendingCount, onSync, onSignOut, version, updated }) {
  const [usage, setUsage] = useState(null);
  const [cleared, setCleared] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  useEffect(() => {
    let alive = true;
    try {
      navigator.storage?.estimate?.().then(e => { if (alive && e?.usage != null) setUsage(e.usage); }).catch(() => {});
    } catch { /* not supported */ }
    return () => { alive = false; };
  }, [pendingCount, cleared]);

  const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 0', borderTop: '1px solid var(--rc-line)', fontSize: '14px' };
  const sub = { fontSize: '12px', color: 'var(--rc-ink2)', marginTop: '2px' };

  return (
    <div style={CARD}>
      <div style={TITLE}>Account &amp; storage</div>

      <div style={{ ...row, borderTop: 'none' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: '600' }}>{user?.name || user?.email || (signedIn ? 'Signed in to Google' : 'Not signed in')}</div>
          <div style={{ ...sub, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.email ? user.email : 'Sign in on the Record screen to save to Google Drive'}
            {user && !signedIn ? ' · Drive not connected right now' : ''}
          </div>
        </div>
        {user && (
          confirmOut ? (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button onClick={() => { setConfirmOut(false); onSignOut(); }} style={{ ...BTN, backgroundColor: '#cc0000', color: '#fff', border: '1px solid #cc0000' }}>Sign out</button>
              <button onClick={() => setConfirmOut(false)} style={BTN}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmOut(true)} style={{ ...BTN, flexShrink: 0 }}>Sign out</button>
          )
        )}
      </div>

      <div style={row}>
        <div>
          <div style={{ fontWeight: '600' }}>
            {pendingCount > 0 ? `${pendingCount} recording${pendingCount === 1 ? '' : 's'} waiting to sync` : 'Everything is synced'}
          </div>
          <div style={sub}>
            {pendingCount > 0
              ? (online ? (signedIn ? 'Saved safely on this device until Google Drive confirms them' : 'Sign in to sync them to Google Drive') : 'Offline — they will sync when you’re back online')
              : 'Nothing is waiting on this device'}
          </div>
        </div>
        {pendingCount > 0 && online && signedIn && <button onClick={onSync} style={{ ...BTN, flexShrink: 0 }}>Sync now</button>}
      </div>

      <div style={row}>
        <div>
          <div style={{ fontWeight: '600' }}>Saved clip details</div>
          <div style={sub}>
            {cleared ? 'Cleared. They’ll download again next time you open the Library.'
              : `Keys and tempos are kept on this device so the Library opens fast${usage != null ? ` · this app uses ${formatMB(usage)} here` : ''}`}
          </div>
        </div>
        <button onClick={() => { clearSidecarCache(); setCleared(true); }} disabled={cleared}
          style={{ ...BTN, flexShrink: 0, color: cleared ? '#aaa' : 'var(--rc-ink)', cursor: cleared ? 'default' : 'pointer' }}>Clear</button>
      </div>
      {pendingCount > 0 && (
        <div style={{ fontSize: '12px', color: '#b45f06', paddingBottom: '8px' }}>
          This never touches recordings that haven&rsquo;t synced yet.
        </div>
      )}

      <div style={{ ...row, justifyContent: 'center', fontSize: '12px', color: 'var(--rc-ink2)', paddingBottom: 0 }}>
        Riff Catalog version {version} · Updated {updated}
      </div>
    </div>
  );
}

// ── the Settings page ───────────────────────────────────────────────────

export default function Settings({ user = null, signedIn = false, online = true, pendingCount = 0, onSync = () => {}, onSignOut = () => {}, version = '', updated = '' }) {
  const [status, setStatus] = useState(getSettingsStatus());
  useEffect(() => subscribeSettingsStatus(setStatus), []);

  const isDefault = ROLES.every(r => NOTE_ROLE_COLORS[r.id] === DEFAULT_NOTE_ROLE_COLORS[r.id]);

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={CARD}>
        <div style={TITLE}>Interval colors</div>
        <div style={HELP}>
          Colors for the root, 3rd, 5th and the key's other notes, used on every fretboard, keyboard, chord diagram, tab card and note row in the app.
          Changes apply immediately and follow you to your other devices.
        </div>
        {ROLES.map(r => <ColorRow key={r.id} role={r} />)}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderTop: '1px solid var(--rc-line)', paddingTop: '12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--rc-ink2)', flex: 1 }}>{STATUS_TEXT[status]}</div>
          <button
            onClick={resetNoteRoleColors} disabled={isDefault}
            style={{ ...BTN, color: isDefault ? '#aaa' : 'var(--rc-ink)', cursor: isDefault ? 'default' : 'pointer', flexShrink: 0 }}>
            Reset to defaults
          </button>
        </div>
      </div>

      <NotationCard />
      <StrumCard />
      <AppearanceCard />
      <AccountCard user={user} signedIn={signedIn} online={online} pendingCount={pendingCount}
        onSync={onSync} onSignOut={onSignOut} version={version} updated={updated} />
    </div>
  );
}
