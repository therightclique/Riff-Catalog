// Local tallies for the usage report (see UsageLog.js). Counts only: how often
// something happened, never what it was. No imports on purpose, so any file can
// use it without creating a loop.
//
// Everything here stays on the device until the next report, which sends the
// amounts and then takes them off.

const STORE = 'rc_usage_v1';

// Events counted, as { name: spreadsheet meaning }. The server accepts exactly these names.
export const EVENTS = {
  uploadFail: 'recordings that failed to upload',
  settingsFail: 'settings/beat saves to Drive that failed',
  errors: 'unexpected app errors',
  jamPlay: 'times Play was pressed in Jam',
  practicePick: 'times Random was pressed in Practice',
  keyLookup: 'Key Finder key picks and note lookups',
  spin: 'Randomizer wheel spins',
  surprise: 'Surprise me uses',
  idea: 'song ideas saved',
  ideaMultiKey: 'saved song ideas that use more than one key',
};

const empty = () => ({ tabs: {}, events: {}, recCount: 0, recSeconds: 0, activeSec: 0, lastError: '', lastReport: 0 });

export function loadCounters() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    const base = { ...empty(), ...(s && typeof s === 'object' ? s : {}) };
    if (!base.events || typeof base.events !== 'object') base.events = {};
    return base;
  } catch { return empty(); }
}
export function saveCounters(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* reporting is best-effort */ } }

export function noteTabView(tab) {
  if (typeof tab !== 'string') return;
  const s = loadCounters();
  s.tabs[tab] = (s.tabs[tab] || 0) + 1;
  saveCounters(s);
}

// Seconds only, taken from the length of a recording made in the app.
export function noteRecording(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const s = loadCounters();
  s.recCount += 1;
  s.recSeconds += seconds;
  saveCounters(s);
}

export function noteEvent(name, n = 1) {
  if (!(name in EVENTS) || !Number.isFinite(n) || n <= 0) return;
  const s = loadCounters();
  s.events[name] = (s.events[name] || 0) + Math.round(n);
  saveCounters(s);
}

// Only the kind of error ("TypeError"), never its message or where it happened.
export function noteError(kind) {
  const s = loadCounters();
  s.events.errors = (s.events.errors || 0) + 1;
  s.lastError = /^[A-Za-z]{3,30}$/.test(String(kind || '')) ? String(kind) : 'Error';
  saveCounters(s);
}

let captureOn = false;
export function installErrorCapture() {
  if (captureOn || typeof window === 'undefined') return;
  captureOn = true;
  let lastAt = 0;
  const throttled = (kind) => { const t = Date.now(); if (t - lastAt < 2000) return; lastAt = t; noteError(kind); };  // an error loop counts as one
  window.addEventListener('error', (e) => throttled(e?.error?.name));
  window.addEventListener('unhandledrejection', (e) => throttled(e?.reason?.name));
}

// Time with the app on screen, in whole seconds. Counted while the page is visible only.
let visibleSince = null;
let timerOn = false;
const SEGMENT_CAP_S = 120;   // a device that slept mid-interval can't add hours
export function flushActive() {
  if (visibleSince == null) return;
  const now = Date.now();
  const sec = Math.min(SEGMENT_CAP_S, Math.max(0, (now - visibleSince) / 1000));
  visibleSince = now;
  if (sec < 1) return;
  const s = loadCounters();
  s.activeSec = (s.activeSec || 0) + Math.round(sec);
  saveCounters(s);
}
export function installActiveTimer() {
  if (timerOn || typeof document === 'undefined') return;
  timerOn = true;
  visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') visibleSince = Date.now();
    else { flushActive(); visibleSince = null; }
  });
  window.addEventListener('pagehide', () => { flushActive(); visibleSince = null; });
  setInterval(flushActive, 30000);
}
