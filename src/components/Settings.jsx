import { useEffect, useRef, useState } from 'react';
import { NOTE_ROLE_COLORS, DEFAULT_NOTE_ROLE_COLORS, NOTE_ROLE_TEXT, isValidHex } from './theme';
import { changeNoteRoleColors, resetNoteRoleColors, getSettingsStatus, subscribeSettingsStatus } from './SettingsService';

const ROLES = [
  { id: 'root', label: 'Root', badge: 'R' },
  { id: 'third', label: '3rd', badge: '3' },
  { id: 'fifth', label: '5th', badge: '5' },
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderTop: '1px solid #e3e3e3' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0, backgroundColor: draft,
        color: isValidHex(draft) ? text : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: '700', fontSize: '16px', border: '1px solid rgba(0,0,0,0.25)' }}>
        {role.badge}
      </div>
      <div style={{ flex: 1, textAlign: 'left', fontSize: '15px', fontWeight: '600', color: '#222' }}>{role.label}</div>
      <input
        value={hexText} onChange={onHexType} onBlur={() => setHexText(draft)}
        aria-label={`${role.label} color hex code`} maxLength={7} spellCheck={false}
        autoCapitalize="off" autoCorrect="off"
        style={{ width: '88px', padding: '8px', fontSize: '14px', fontFamily: 'monospace', border: '1px solid #ccc',
          borderRadius: '6px', backgroundColor: '#fff', color: '#222', textTransform: 'lowercase' }}
      />
      <input
        type="color" value={draft} onChange={e => choose(e.target.value)}
        aria-label={`${role.label} color picker`}
        style={{ width: '52px', height: '40px', padding: 0, border: '1px solid #ccc', borderRadius: '6px',
          backgroundColor: '#fff', cursor: 'pointer', flexShrink: 0 }}
      />
    </div>
  );
}

export default function Settings() {
  const [status, setStatus] = useState(getSettingsStatus());
  useEffect(() => subscribeSettingsStatus(setStatus), []);

  const isDefault = ROLES.every(r => NOTE_ROLE_COLORS[r.id] === DEFAULT_NOTE_ROLE_COLORS[r.id]);

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '8px', color: '#222' }}>
        <div style={{ fontSize: '17px', fontWeight: '700', marginBottom: '4px' }}>Interval colors</div>
        <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.4, marginBottom: '8px' }}>
          Colors for the root, 3rd and 5th, used on every fretboard, chord diagram, tab card and note list in the app.
          Changes apply immediately and follow you to your other devices.
        </div>
        {ROLES.map(r => <ColorRow key={r.id} role={r} />)}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderTop: '1px solid #e3e3e3', paddingTop: '12px' }}>
          <div style={{ fontSize: '12px', color: '#666', flex: 1 }}>{STATUS_TEXT[status]}</div>
          <button
            onClick={resetNoteRoleColors} disabled={isDefault}
            style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '6px', border: '1px solid #ccc',
              backgroundColor: '#fff', color: isDefault ? '#aaa' : '#222', cursor: isDefault ? 'default' : 'pointer', flexShrink: 0 }}>
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
