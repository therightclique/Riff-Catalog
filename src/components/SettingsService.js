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

const LS_KEY = 'rc_settings';
const FILE_NAME = 'riffcatalog-settings.json';
const PUSH_DELAY_MS = 500;

let updatedAt = null;     // ISO time of the last change (local or adopted from Drive)
let dirty = false;        // a local change not yet confirmed on Drive
let token = null;
let remoteFileId = null;
let pushTimer = null;
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

const snapshot = () => ({
  version: 1,
  updatedAt,
  noteRoleColors: { ...NOTE_ROLE_COLORS },
  prefs: { ...prefs },
});

function saveLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ...snapshot(), dirty })); } catch { /* storage unavailable — Drive copy still works */ }
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
    if (dirty) status = 'device-only';
  } catch { /* corrupt entry — fall back to defaults */ }
})();

// ── the user's choices ──────────────────────────────────────────────────

// Apply + save a color change right away. `partial` is e.g. { root: '#00ff00' }.
export function changeNoteRoleColors(partial) {
  if (!applyNoteRoleColors({ ...NOTE_ROLE_COLORS, ...partial })) return;
  updatedAt = new Date().toISOString();
  dirty = true;
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
  if (!dirty) { setStatus('saved'); return; }
  if (!token || !navigator.onLine) { setStatus('device-only'); return; }
  if (pushing) { schedulePush(); return; }
  pushing = true;
  const sentAt = updatedAt;
  try {
    await writeRemote();
    // Only mark clean if nothing changed while the request was in flight.
    if (updatedAt === sentAt) { dirty = false; saveLocal(); setStatus('saved'); }
    else schedulePush();
  } catch (err) {
    console.warn('[settings] could not save to Drive — kept on this device:', err);
    setStatus('device-only');
  } finally {
    pushing = false;
  }
}

// Call whenever a Drive token is available (sign-in, reconnect, app returns
// to the foreground, connection comes back). Adopts newer settings from
// Drive, or pushes newer/unsaved local ones.
export async function syncSettings(newToken) {
  if (newToken) token = newToken;
  if (!token || !navigator.onLine) return;
  try {
    if (!remoteFileId) remoteFileId = await findRemote();
    if (remoteFileId) {
      const remote = await readRemote(remoteFileId);
      const remoteTime = remote?.updatedAt || '';
      if (!dirty && remoteTime > (updatedAt || '')) {
        applyNoteRoleColors(remote.noteRoleColors);
        if (remote.prefs) applyPrefs(remote.prefs);
        updatedAt = remoteTime;
        saveLocal();
        setStatus('saved');
        return;
      }
      if (!dirty && remoteTime === (updatedAt || '')) { setStatus('saved'); return; }
      // Local is newer (or has unsaved changes): fall through and push.
      if (!dirty && updatedAt) dirty = true;
    } else if (updatedAt) {
      dirty = true; // a choice exists locally but Drive has no copy yet
    }
    if (dirty) { setStatus('saving'); await pushNow(); }
    else setStatus('saved');
  } catch (err) {
    console.warn('[settings] Drive sync skipped:', err);
    if (dirty) setStatus('device-only');
  }
}
