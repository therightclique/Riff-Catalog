// Local tallies for the usage report (see UsageLog.js). Counts, times and short
// problem codes only: how often something happened, never what it was. No imports
// on purpose, so any file can use it without creating a loop.
//
// Everything here stays on the device until the next report, which sends the
// amounts and then takes them off.

const STORE = 'rc_usage_v1';

// Events counted. The server accepts exactly these names.
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
  reauth: 'times the Google Drive connection had to be renewed',
  micDenied: 'microphone permission refusals',
  micError: 'other microphone problems',
  audioFail: 'times sound could not start',
  libFilter: 'Library filter changes',
  libSort: 'Library sort changes',
  clipPlay: 'clips played',
  recMorning: 'recordings made 5am-11am',
  recAfternoon: 'recordings made 11am-5pm',
  recEvening: 'recordings made 5pm-10pm',
  recNight: 'recordings made 10pm-5am',
  recWeekday: 'recordings made Mon-Fri',
  recWeekend: 'recordings made Sat-Sun',
  recShort: 'takes under 30 seconds',
  recMedium: 'takes 30 seconds to 2 minutes',
  recLong: 'takes 2 to 5 minutes',
  recVeryLong: 'takes over 5 minutes',
};

// First-use moments, kept as the time they first happened.
export const MILESTONE_KEYS = ['recording', 'driveSave', 'library', 'jam', 'keyfinder', 'practice', 'randomizer', 'idea', 'feedback'];
const EVENT_MILESTONE = { jamPlay: 'jam', keyLookup: 'keyfinder', practicePick: 'practice', spin: 'randomizer', surprise: 'randomizer', idea: 'idea' };

const MAX_QUEUE = 40;     // problems waiting to be reported
const MAX_RECENT = 50;    // problems kept for the Debug screen's report
const AREAS = ['upload', 'sync', 'settings', 'mic', 'audio', 'analysis', 'app', 'drive', 'library', 'recorder'];

const empty = () => ({ tabs: {}, events: {}, recCount: 0, recSeconds: 0, activeSec: 0, lastError: '', lastReport: 0, milestones: {}, msSent: {}, upload: { count: 0, sec: 0 }, problems: [], recent: [] });

export function loadCounters() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    const base = { ...empty(), ...(s && typeof s === 'object' ? s : {}) };
    for (const k of ['events', 'milestones', 'msSent']) if (!base[k] || typeof base[k] !== 'object') base[k] = {};
    if (!base.upload || typeof base.upload !== 'object') base.upload = { count: 0, sec: 0 };
    for (const k of ['problems', 'recent']) if (!Array.isArray(base[k])) base[k] = [];
    return base;
  } catch { return empty(); }
}
export function saveCounters(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* reporting is best-effort */ } }

let currentView = '';
export function noteMilestone(key) {
  if (!MILESTONE_KEYS.includes(key)) return;
  const s = loadCounters();
  if (s.milestones[key]) return;
  s.milestones[key] = new Date().toISOString();
  saveCounters(s);
}

export function noteTabView(tab) {
  if (typeof tab !== 'string') return;
  currentView = tab;
  const s = loadCounters();
  s.tabs[tab] = (s.tabs[tab] || 0) + 1;
  if (tab === 'library' && !s.milestones.library) s.milestones.library = new Date().toISOString();
  saveCounters(s);
}

// Seconds only, taken from the length of a recording made in the app. Also tallies when in the
// day / week it was made (the person's own clock) and how long the take was.
export function noteRecording(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const s = loadCounters();
  s.recCount += 1;
  s.recSeconds += seconds;
  const now = new Date(), h = now.getHours(), dow = now.getDay();
  const bump = (k) => { s.events[k] = (s.events[k] || 0) + 1; };
  bump(h >= 5 && h < 11 ? 'recMorning' : h >= 11 && h < 17 ? 'recAfternoon' : h >= 17 && h < 22 ? 'recEvening' : 'recNight');
  bump(dow === 0 || dow === 6 ? 'recWeekend' : 'recWeekday');
  bump(seconds < 30 ? 'recShort' : seconds < 120 ? 'recMedium' : seconds < 300 ? 'recLong' : 'recVeryLong');
  if (!s.milestones.recording) s.milestones.recording = now.toISOString();
  saveCounters(s);
}

export function noteEvent(name, n = 1) {
  if (!(name in EVENTS) || !Number.isFinite(n) || n <= 0) return;
  const s = loadCounters();
  s.events[name] = (s.events[name] || 0) + Math.round(n);
  const m = EVENT_MILESTONE[name];
  if (m && !s.milestones[m]) s.milestones[m] = new Date().toISOString();
  saveCounters(s);
}

// How long one upload to Drive took (seconds). Averaged on the server.
export function noteUpload(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600) return;
  const s = loadCounters();
  s.upload.count += 1;
  s.upload.sec += seconds;
  saveCounters(s);
}

// A short code for what went wrong, built from error NAMES and web status numbers only, never messages.
// Turns an Error (or message text) into e.g. "Error 401" without keeping the text.
export function problemCode(err) {
  const name = /^[A-Za-z]{3,30}$/.test(String(err?.name || '')) ? err.name : 'Error';
  // Only well-known web status numbers count, so at most one of a dozen codes can ever be taken from text, never a name.
  const status = /\b(400|401|403|404|408|409|413|429|500|502|503|504)\b/.exec(String(err?.message || err || ''));
  return status ? `${name} ${status[1]}` : name;
}

// Adds one line to the problem log (the Errors sheet, and the Debug screen's report).
export function noteProblem(area, code) {
  if (!AREAS.includes(area)) return;
  const c = /^[A-Za-z0-9 :._\-]{1,40}$/.test(String(code || '')) ? String(code) : 'Unknown';
  const s = loadCounters();
  const t = new Date().toISOString();
  const entry = { t, area, code: c, view: currentView || '', n: 1 };
  // The same problem repeating within a minute is one line with a count, not a flood.
  for (const list of [s.problems, s.recent]) {
    const last = list[list.length - 1];
    if (last && last.area === area && last.code === c && Date.now() - Date.parse(last.t) < 60000) last.n = Math.min(999, (last.n || 1) + 1);
    else list.push({ ...entry });
  }
  while (s.problems.length > MAX_QUEUE) s.problems.shift();
  while (s.recent.length > MAX_RECENT) s.recent.shift();
  saveCounters(s);
}

// Only the kind of error ("TypeError"), never its message or where it happened.
export function noteError(kind) {
  const s = loadCounters();
  s.events.errors = (s.events.errors || 0) + 1;
  s.lastError = /^[A-Za-z]{3,30}$/.test(String(kind || '')) ? String(kind) : 'Error';
  saveCounters(s);
  noteProblem('app', s.lastError);
}

export const recentProblems = () => loadCounters().recent.slice();

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
