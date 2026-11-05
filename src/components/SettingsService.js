// The app's saved settings: the note colors, strum speed and sharps/flats.
// (Light/dark lives in Appearance.js — it's saved per device, not synced.)
//
// Saved two places, so a choice survives restarts AND follows the user to
// other devices:
//   • this device's localStorage — instant, works offline, applied at startup
//   • a small file in the user's Google Drive (RiffCatalog/riffcatalog-settings.json)
//     — read on sign-in and whenever the app comes back to the foreground, so
//     a color picked on one device shows up on the others.
// The newer `updatedAt` wins. A change made offline is kept and pushed to
// Drive as soon as a connection and token are available.

import { NOTE_ROLE_COLORS, DEFAULT_NOTE_ROLE_COLORS, applyNoteRoleColors } from './theme';
import { applyAccidentals } from './Notation';
import { setStrumScale } from './AudioEngine';
import { getOrCreateFolder, FOLDER_NAME } from './DriveUploader';
import { noteEvent, noteProblem, problemCode } from './UsageCounters';

const LS_KEY = 'rc_settings';
const FILE_NAME = 'riffcatalog-settings.json';
const PUSH_DELAY_MS = 500;

let updatedAt = null;     // ISO time of the last change (local or adopted from Drive)
let dirty = false;        // a local change not yet confirmed on Drive
let token = null;
let remoteFileId = null;
let pushTimer = null;
let beatsDirty = false;   // saved Jam beats changed locally and not yet confirmed on Drive
let changeSeq = 0;        // bumped on every local change, so a push knows whether more arrived mid-flight
let pushing = false;
let status = 'saved';     // 'saved' | 'saving' | 'device-only'
const statusListeners = new Set();

function setStatus(s) {
  if (s === status) return;
  status = s;
  statusListeners.forEach(fn => { try { fn(s); } catch { /* ignore */ } });
}
export const getSettingsStatus = () => status;
export function subscribeSettingsStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

const DEFAULT_PREFS = Object.freeze({ strum: 1, accidentals: 'sharps' });
let prefs = { ...DEFAULT_PREFS };
const prefListeners = new Set();
export const getPrefs = () => prefs;
export function subscribePrefs(fn) { prefListeners.add(fn); return () => prefListeners.delete(fn); }

// Put a set of preferences into effect (startup, a change here, or adopted from another device).
function applyPrefs(p) {
  const next = {
    strum: Number.isFinite(p?.strum) && p.strum >= 0.1 && p.strum <= 3 ? p.strum : DEFAULT_PREFS.strum,
    accidentals: p?.accidentals === 'flats' ? 'flats' : 'sharps',
  };
  prefs = next;
  setStrumScale(next.strum);
  applyAccidentals(next.accidentals);
  prefListeners.forEach(fn => { try { fn(prefs); } catch { /* ignore */ } });
}

// ── saved Jam beats ─────────────────────────────────────────────────────
// Named drum beats live in the same settings file on Drive, so they follow the
// user to every device. Each beat carries its own updatedAt, and a deleted beat
// is kept as a small "deleted" marker for 90 days, so two devices merge cleanly
// instead of one overwriting the other.
let jamBeats = [];        // [{ id, name, bpm, grid, updatedAt }] or [{ id, deleted: true, updatedAt }]
const beatListeners = new Set();
const TOMBSTONE_MS = 90 * 24 * 3600 * 1000;

function cleanBeat(b) {
  if (!b || typeof b !== 'object') return null;
  const id = typeof b.id === 'string' && b.id && b.id.length <= 40 ? b.id : null;
  if (!id) return null;
  const at = typeof b.updatedAt === 'string' && !Number.isNaN(Date.parse(b.updatedAt)) ? b.updatedAt : new Date(0).toISOString();
  if (b.deleted === true) return { id, deleted: true, updatedAt: at };
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 40) : '';
  if (!name) return null;
  const bpm = Number.isFinite(Number(b.bpm)) ? Math.min(400, Math.max(20, Math.round(Number(b.bpm)))) : 100;
  const grid = {};
  if (b.grid && typeof b.grid === 'object') {
    for (const [k, v] of Object.entries(b.grid)) {
      if (/^[a-z]{1,8}$/i.test(k) && typeof v === 'string' && /^[x.]{16}$/.test(v)) grid[k] = v;
    }
  }
  return { id, name, bpm, grid, updatedAt: at };
}

function pruneBeats() {
  const cutoff = Date.now() - TOMBSTONE_MS;
  jamBeats = jamBeats.filter(b => !b.deleted || Date.parse(b.updatedAt) > cutoff);
}

const notifyBeats = () => beatListeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });
export const getJamBeats = () => jamBeats.filter(b => !b.deleted);
export function subscribeJamBeats(fn) { beatListeners.add(fn); return () => beatListeners.delete(fn); }

// Merge a beat list from Drive into ours: for each beat the newer copy wins.
// Flags beatsDirty when we hold something Drive doesn't have yet.
function mergeBeats(list) {
  const remote = new Map();
  for (const x of Array.isArray(list) ? list : []) {
    const c = cleanBeat(x);
    if (c) { const p = remote.get(c.id); if (!p || c.updatedAt > p.updatedAt) remote.set(c.id, c); }
  }
  const local = new Map(jamBeats.map(b => [b.id, b]));
  let changed = false;
  for (const [id, r] of remote) {
    const l = local.get(id);
    if (!l || r.updatedAt > l.updatedAt) { local.set(id, r); changed = true; }
  }
  for (const [id, l] of local) {
    const r = remote.get(id);
    if (!r || l.updatedAt > r.updatedAt) beatsDirty = true;
  }
  if (changed) { jamBeats = [...local.values()]; pruneBeats(); saveLocal(); notifyBeats(); }
  return changed;
}

function afterBeatChange() {
  beatsDirty = true;
  changeSeq++;
  saveLocal();
  notifyBeats();
  setStatus(token && navigator.onLine ? 'saving' : 'device-only');
  schedulePush();
}

// Add or replace a beat: { id, name, bpm, grid }.
export function saveJamBeat(beat) {
  const c = cleanBeat({ ...beat, updatedAt: new Date().toISOString() });
  if (!c || c.deleted) return;
  const i = jamBeats.findIndex(b => b.id === c.id);
  if (i >= 0) jamBeats[i] = c; else jamBeats.push(c);
  afterBeatChange();
}

export function deleteJamBeat(id) {
  const i = jamBeats.findIndex(b => b.id === id);
  if (i < 0) return;
  jamBeats[i] = { id, deleted: true, updatedAt: new Date().toISOString() };
  afterBeatChange();
}

const snapshot = () => {
  pruneBeats();
  return {
    version: 1,
    updatedAt,
    noteRoleColors: { ...NOTE_ROLE_COLORS },
    prefs: { ...prefs },
    jamBeats: jamBeats.map(b => ({ ...b })),
  };
};

function saveLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ...snapshot(), dirty, beatsDirty })); } catch { /* storage unavailable — Drive copy still works */ }
}

// Applied once at import time, i.e. before the first screen is drawn, so
// there's no flash of the default colors.
(function initFromLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    applyNoteRoleColors(s.noteRoleColors);
    applyPrefs(s.prefs);
    updatedAt = s.updatedAt || null;
    dirty = !!s.dirty;
    beatsDirty = !!s.beatsDirty;
    jamBeats = (Array.isArray(s.jamBeats) ? s.jamBeats : []).map(cleanBeat).filter(Boolean);
    if (dirty || beatsDirty) status = 'device-only';
  } catch { /* corrupt entry — fall back to defaults */ }
})();

// One-time move of beats saved before beats lived in the settings file (they were
// kept only on this device). The old copy is left in place as a backup.
(function migrateDeviceBeats() {
  try {
    if (localStorage.getItem('rc_jam_beats_migrated')) return;
    const list = JSON.parse(localStorage.getItem('rc_jam_beats') || '[]');
    if (Array.isArray(list)) {
      const known = new Set(jamBeats.map(b => b.id));
      const stamp = new Date().toISOString();
      let added = 0;
      for (const x of list) {
        const c = cleanBeat({ ...x, id: String(x?.id || x?.name || ''), updatedAt: stamp });
        if (c && !c.deleted && !known.has(c.id)) { jamBeats.push(c); known.add(c.id); added++; }
      }
      if (added) { beatsDirty = true; status = 'device-only'; saveLocal(); }
    }
    localStorage.setItem('rc_jam_beats_migrated', '1');
  } catch { /* nothing to migrate */ }
})();

// ── the user's choices ──────────────────────────────────────────────────

// Apply + save a color change right away. `partial` is e.g. { root: '#00ff00' }.
export function changeNoteRoleColors(partial) {
  if (!applyNoteRoleColors({ ...NOTE_ROLE_COLORS, ...partial })) return;
  updatedAt = new Date().toISOString();
  dirty = true;
  changeSeq++;
  saveLocal();
  setStatus(token && navigator.onLine ? 'saving' : 'device-only');
  schedulePush();
}

export const resetNoteRoleColors = () => changeNoteRoleColors(DEFAULT_NOTE_ROLE_COLORS);

// Apply + save a preference change right away, e.g. { strum: 1.6 } or { accidentals: 'flats' }.
export function changePrefs(partial) {
  applyPrefs({ ...prefs, ...partial });
  updatedAt = new Date().toISOString();
  dirty = true;
  changeSeq++;
  saveLocal();
  setStatus(token && navigator.onLine ? 'saving' : 'device-only');
  schedulePush();
}

// ── Drive ───────────────────────────────────────────────────────────────

const auth = () => ({ Authorization: `Bearer ${token}` });

async function findRemote() {
  const q = `name='${FILE_NAME}' and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&orderBy=createdTime`,
    { headers: auth() }
  );
  if (!res.ok) throw new Error(`Settings lookup failed (${res.status})`);
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

async function readRemote(id) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers: auth() });
  if (!res.ok) throw new Error(`Settings read failed (${res.status})`);
  return res.json();
}

async function writeRemote() {
  const body = JSON.stringify(snapshot(), null, 2);
  if (remoteFileId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${remoteFileId}?uploadType=media`,
      { method: 'PATCH', headers: { ...auth(), 'Content-Type': 'application/json' }, body }
    );
    if (res.status === 404) { remoteFileId = null; return writeRemote(); } // file was removed — recreate
    if (!res.ok) throw new Error(`Settings save failed (${res.status})`);
    return;
  }
  const rootId = await getOrCreateFolder(token, FOLDER_NAME);
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({ name: FILE_NAME, parents: [rootId] })], { type: 'application/json' }));
  form.append('file', new Blob([body], { type: 'application/json' }));
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    { method: 'POST', headers: auth(), body: form }
  );
  if (!res.ok) throw new Error(`Settings save failed (${res.status})`);
  remoteFileId = (await res.json()).id;
}

function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, PUSH_DELAY_MS);
}

async function pushNow() {
  if (!dirty && !beatsDirty) { setStatus('saved'); return; }
  if (!token || !navigator.onLine) { setStatus('device-only'); return; }
  if (pushing) { schedulePush(); return; }
  pushing = true;
  const sentSeq = changeSeq;
  try {
    // Look at Drive first, so this write never drops beats another device saved meanwhile.
    if (remoteFileId) {
      try {
        const remote = await readRemote(remoteFileId);
        mergeBeats(remote?.jamBeats);
        if (!dirty && (remote?.updatedAt || '') > (updatedAt || '')) adoptRemoteSettings(remote);
      } catch { /* the write below reports any real problem */ }
    }
    await writeRemote();
    // Only mark clean if nothing changed while the request was in flight.
    if (changeSeq === sentSeq) { dirty = false; beatsDirty = false; saveLocal(); setStatus('saved'); }
    else schedulePush();
  } catch (err) {
    console.warn('[settings] could not save to Drive — kept on this device:', err);
    noteEvent('settingsFail');
    noteProblem('settings', problemCode(err));
    setStatus('device-only');
  } finally {
    pushing = false;
  }
}

function adoptRemoteSettings(remote) {
  applyNoteRoleColors(remote.noteRoleColors);
  if (remote.prefs) applyPrefs(remote.prefs);
  updatedAt = remote.updatedAt || null;
  saveLocal();
}

// Call whenever a Drive token is available (sign-in, reconnect, app returns
// to the foreground, connection comes back). Adopts newer settings from
// Drive, merges saved beats, or pushes newer/unsaved local ones.
export async function syncSettings(newToken) {
  if (newToken) token = newToken;
  if (!token || !navigator.onLine) return;
  try {
    if (!remoteFileId) remoteFileId = await findRemote();
    if (remoteFileId) {
      const remote = await readRemote(remoteFileId);
      const remoteTime = remote?.updatedAt || '';
      mergeBeats(remote?.jamBeats);
      if (!dirty && remoteTime > (updatedAt || '')) {
        adoptRemoteSettings(remote);
      } else if (!dirty && remoteTime < (updatedAt || '')) {
        dirty = true;   // this device's settings are newer than Drive's
      }
    } else {
      if (updatedAt) dirty = true;           // a choice exists locally but Drive has no copy yet
      if (jamBeats.length) beatsDirty = true;
    }
    if (dirty || beatsDirty) { setStatus('saving'); await pushNow(); }
    else setStatus('saved');
  } catch (err) {
    console.warn('[settings] Drive sync skipped:', err);
    if (dirty || beatsDirty) setStatus('device-only');
  }
}
