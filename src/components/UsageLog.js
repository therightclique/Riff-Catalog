// Riff Catalog usage reporting.
//
// What leaves the device: counts, dates and a few device/app facts - how many
// clips and song ideas exist, how often each section and feature is used, time
// with the app open, failures, device and settings choices. Never clip names,
// lyrics, notes, idea text, beat patterns or any audio. The About > Privacy
// Policy tab lists exactly this, so keep the two in step.
//
// The app opens -> one small report -> one row per person in the owner's
// spreadsheet is updated (see netlify/functions/log-usage.mjs).

import { fetchClips } from './DriveLibrary';
import { listTextFiles } from './DriveUploader';
import { listPendingSummaries } from './OfflineStore';
import { getJamBeats, getPrefs } from './SettingsService';
import { getTheme } from './Appearance';
import { NOTE_ROLE_COLORS, DEFAULT_NOTE_ROLE_COLORS } from './theme';
import { sendOrQueue, flushOutbox, backoffRemainingMs, noteSendFailure, noteSendSuccess } from './UsageOutbox';
import { loadCounters, saveCounters, noteTabView, noteRecording, noteEvent, noteMilestone, noteUpload, noteProblem, problemCode, recentProblems, installErrorCapture, installActiveTimer, flushActive } from './UsageCounters';

export { noteTabView, noteRecording, noteEvent, noteMilestone, noteUpload, noteProblem, problemCode, recentProblems, installErrorCapture, installActiveTimer };

const ENDPOINT = '/.netlify/functions/log-usage';
const MIN_GAP_MS = 15 * 60 * 1000;   // reopening within 15 minutes counts as the same visit
const load = loadCounters;
const save = saveCounters;

function deviceKind() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Other';
}

function isInstalled() {
  try {
    return !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
  } catch { return false; }
}

function beatCount() {
  try { return getJamBeats().length; } catch { return null; }
}

// Best-effort estimate of an iPhone model from its screen (Safari never reveals the real model).
const IPHONES = {
  '320x568@2': 'iPhone SE (1st gen) / 5s', '375x667@2': 'iPhone 6 / 7 / 8 / SE (2nd-3rd gen)', '414x736@3': 'iPhone 6 Plus / 7 Plus / 8 Plus',
  '375x812@3': 'iPhone X / XS / 11 Pro / 12 mini / 13 mini', '414x896@2': 'iPhone XR / 11', '414x896@3': 'iPhone XS Max / 11 Pro Max',
  '390x844@3': 'iPhone 12 / 13 / 14 / 16e', '428x926@3': 'iPhone 12 Pro Max / 13 Pro Max / 14 Plus',
  '393x852@3': 'iPhone 14 Pro / 15 / 15 Pro / 16', '430x932@3': 'iPhone 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus',
  '402x874@3': 'iPhone 16 Pro / 17 / 17 Pro', '440x956@3': 'iPhone 16 Pro Max / 17 Pro Max', '420x912@3': 'iPhone Air',
};

// Operating system, device model, screen and browser. Only what the browser
// itself offers; the model is exact on Android (Chrome shares it) and an
// estimate on iPhone. Nothing here identifies a person.
async function deviceDetails() {
  const ua = navigator.userAgent || '';
  const out = { os: '', model: '', screen: '', browser: '' };
  let hi = null;
  try {
    if (navigator.userAgentData?.getHighEntropyValues) hi = await navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion']);
  } catch { /* not offered */ }
  const major = (v) => String(v || '').split('.')[0];
  let m;
  if ((m = /OS (\d+)[_.](\d+)/.exec(ua)) && /iPhone|iPad|iPod/.test(ua)) {
    // The OS number inside the user agent is frozen by Apple; Safari's own version number matches the real iOS version.
    const sv = /Version\/(\d+)\.(\d+)/.exec(ua);
    out.os = sv && Number(sv[1]) >= Number(m[1]) ? `iOS ${sv[1]}.${sv[2]}` : `iOS ${m[1]}.${m[2]}`;
  }
  else if (/Android/.test(ua)) out.os = `Android ${major(hi?.platformVersion) || (/Android (\d+)/.exec(ua) || [])[1] || ''}`.trim();
  else if (/Windows/.test(ua)) out.os = hi?.platformVersion ? (Number(major(hi.platformVersion)) >= 13 ? 'Windows 11' : 'Windows 10') : 'Windows 10/11';
  else if (/Macintosh/.test(ua)) out.os = hi?.platformVersion ? `macOS ${major(hi.platformVersion)}` : 'macOS';
  else if (/CrOS/.test(ua)) out.os = 'ChromeOS';
  else if (/Linux/.test(ua)) out.os = 'Linux';
  try {
    const w = Math.min(screen.width, screen.height), h = Math.max(screen.width, screen.height);
    const r = Math.round((window.devicePixelRatio || 1) * 100) / 100;
    out.screen = `${w}x${h}@${r}`;
    if (/iPhone/.test(ua)) out.model = IPHONES[out.screen] ? `${IPHONES[out.screen]} (estimated)` : 'iPhone (unrecognized screen)';
  } catch { /* no screen info */ }
  if (hi?.model) out.model = String(hi.model).slice(0, 40);
  if ((m = /(?:CriOS|Chrome)\/(\d+)/.exec(ua)) && !/Edg\/|OPR\//.test(ua)) out.browser = `Chrome ${m[1]}`;
  else if ((m = /Edg\/(\d+)/.exec(ua))) out.browser = `Edge ${m[1]}`;
  else if ((m = /OPR\/(\d+)/.exec(ua))) out.browser = `Opera ${m[1]}`;
  else if ((m = /(?:FxiOS|Firefox)\/(\d+)/.exec(ua))) out.browser = `Firefox ${m[1]}`;
  else if (/Safari|AppleWebKit/.test(ua)) out.browser = `Safari ${(/Version\/([\d.]+)/.exec(ua) || [])[1] || ''}`.trim();
  return out;
}

function pendingCount() {
  return listPendingSummaries().then(l => (Array.isArray(l) ? l.length : null)).catch(() => null);
}

// Of the clips whose details this device has loaded, how many have a key, a tempo, tags.
function libraryHealth() {
  try {
    const cache = JSON.parse(localStorage.getItem('riffcatalog:sidecarCache:v1') || '{}');
    let key = 0, tempo = 0, tags = 0;
    for (const e of Object.values(cache)) {
      const d = e?.data || {};
      if (d.key) key++;
      if (d.bpm) tempo++;
      if (Array.isArray(d.tags) && d.tags.length) tags++;
    }
    return { withKey: key, withTempo: tempo, withTags: tags };
  } catch { return { withKey: null, withTempo: null, withTags: null }; }
}

function settingsChoices() {
  let custom = null;
  try { custom = Object.keys(DEFAULT_NOTE_ROLE_COLORS).some(k => String(NOTE_ROLE_COLORS[k]).toLowerCase() !== String(DEFAULT_NOTE_ROLE_COLORS[k]).toLowerCase()); } catch { /* unknown */ }
  let prefs = {};
  try { prefs = getPrefs() || {}; } catch { /* unknown */ }
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* unknown */ }
  return {
    theme: ['light', 'dark'].includes(getTheme?.()) ? getTheme() : 'match device',
    accidentals: prefs.accidentals === 'flats' ? 'Flats' : 'Sharps',
    strum: Number.isFinite(prefs.strum) ? Math.round(prefs.strum * 100) / 100 : null,
    customColors: custom === null ? null : custom,
    colors: { root: NOTE_ROLE_COLORS.root, third: NOTE_ROLE_COLORS.third, fifth: NOTE_ROLE_COLORS.fifth, other: NOTE_ROLE_COLORS.other },
    timeZone: tz,
    language: navigator.language || '',
  };
}

// How much storage this app uses on the device, in whole megabytes (the app's own data only).
async function storageUsedMB() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e && Number.isFinite(e.usage) ? Math.round(e.usage / 1048576) : null;
  } catch { return null; }
}

// The Debug screen's "Send diagnostic report": device facts plus the short problem codes shown there.
// Never console text. The person presses the button; nothing is sent otherwise.
export async function sendDiagnostic(accessToken, version, note) {
  const details = await deviceDetails();
  const pending = await pendingCount();
  const lines = recentProblems().map(p => `${new Date(p.t).toISOString().slice(5, 16).replace('T', ' ')} ${p.area} ${p.code}${p.view ? ' > ' + p.view : ''}${p.n > 1 ? ' x' + p.n : ''}`);
  // 'sent' | 'queued' (saved on this device, goes out automatically) | 'failed'
  return sendOrQueue('diagnostic', {
    version, note: String(note || '').slice(0, 500), device: deviceKind(), installed: isInstalled(), online: navigator.onLine,
    ...details, pendingClips: pending, storageMB: await storageUsedMB(), problems: lines,
  }, accessToken);
}

// Support > Contact support. The person's own words, plus (only if they leave the box ticked) the same short technical
// details as a diagnostic report. 'sent' | 'queued' (saved on this device, goes out automatically) | 'failed'.
export async function sendSupport(accessToken, version, message, withDetails, images = []) {
  let extra = {};
  if (withDetails) {
    const details = await deviceDetails();
    const pending = await pendingCount();
    const lines = recentProblems().map(p => `${new Date(p.t).toISOString().slice(5, 16).replace('T', ' ')} ${p.area} ${p.code}${p.view ? ' > ' + p.view : ''}${p.n > 1 ? ' x' + p.n : ''}`);
    extra = { device: deviceKind(), installed: isInstalled(), online: navigator.onLine, ...details, pendingClips: pending, problems: lines };
  }
  return sendOrQueue('support', { version, message: String(message || '').slice(0, 2000), details: !!withDetails, images: images.slice(0, 3), ...extra }, accessToken);
}

// Owner only: how many support requests are unread. Returns { unread, newest } or null if it couldn't be checked.
export async function fetchSupportUnread(accessToken) {
  try {
    if (!accessToken) return null;
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'supportcount', accessToken }) });
    if (!res.ok) return null;
    const j = await res.json();
    return Number.isFinite(j.unread) ? { unread: j.unread, newest: j.newest || '' } : null;
  } catch { return null; }
}

// Sends one report. Never throws and never blocks the app; if anything fails
// the counts stay on the device and go out with the next report.
export async function reportUsage(accessToken, version) {
  try {
    if (!accessToken || !navigator.onLine) return false;
    flushOutbox(accessToken);   // anything written earlier that couldn't be sent
    if (backoffRemainingMs() > 0) { scheduleRetry(accessToken, version); return false; }   // the server asked for a pause
    const before = load();
    if (Date.now() - before.lastReport < MIN_GAP_MS) return false;
    before.lastReport = Date.now();   // claim the slot first so two quick calls can't both send
    save(before);

    const listStart = Date.now();
    let driveListMs = null;
    const [clips, ideas] = await Promise.all([
      fetchClips(accessToken).then(f => { driveListMs = Date.now() - listStart; return Array.isArray(f) ? f.length : null; }).catch(() => null),
      listTextFiles(accessToken, 'Randomizer').then(f => (Array.isArray(f) ? f.length : null)).catch(() => null),
    ]);

    flushActive();
    const sent = load();   // counts as of this moment; whatever arrives while the request is out stays pending
    const pending = await pendingCount();
    const unsentMilestones = Object.fromEntries(Object.entries(sent.milestones || {}).filter(([k]) => !(sent.msSent || {})[k]));
    const body = {
      accessToken,
      driveListMs,
      storageMB: await storageUsedMB(),
      milestones: unsentMilestones,
      problems: (sent.problems || []).slice(0, 20),
      pendingClips: pending,
      library: libraryHealth(),
      choices: settingsChoices(),
      lastError: sent.lastError || null,
      version,
      device: deviceKind(),
      installed: isInstalled(),
      ...(await deviceDetails()),
      clipCount: clips,
      ideaCount: ideas,
      beatCount: beatCount(),
      delta: { tabs: sent.tabs, events: sent.events, activeSec: Math.round(sent.activeSec || 0), upload: { count: sent.upload?.count || 0, sec: Math.round(sent.upload?.sec || 0) }, recCount: sent.recCount, recSeconds: Math.round(sent.recSeconds) },
    };
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const s = load(); s.lastReport = 0; save(s);   // the counts stay on the device; allow a retry
      // Busy or erroring server: wait longer each time (with a random spread) rather than asking again at once.
      // A rejected sign-in (401) isn't the server's fault, so it doesn't lengthen the wait.
      if (res.status !== 401 && res.status !== 403) {
        let ra = 0; try { ra = Number(res.headers.get('retry-after')) || 0; } catch { /* no header */ }
        scheduleRetry(accessToken, version, noteSendFailure(ra));
      }
      return false;
    }
    noteSendSuccess();
    // Success: take off exactly what was sent.
    try { const j = await res.json(); localStorage.setItem('rc_owner', j?.owner === true ? '1' : ''); } catch { /* flag unchanged */ }
    const now = load();
    for (const k of Object.keys(unsentMilestones)) now.msSent[k] = true;
    const sentKeys = new Set((body.problems || []).map(x => `${x.t}|${x.area}|${x.code}`));
    now.problems = (now.problems || []).filter(x => !sentKeys.has(`${x.t}|${x.area}|${x.code}`));
    now.upload = { count: Math.max(0, (now.upload?.count || 0) - (sent.upload?.count || 0)), sec: Math.max(0, (now.upload?.sec || 0) - Math.round(sent.upload?.sec || 0)) };
    for (const [k, v] of Object.entries(sent.tabs)) {
      now.tabs[k] = Math.max(0, (now.tabs[k] || 0) - v);
      if (!now.tabs[k]) delete now.tabs[k];
    }
    for (const [k, v] of Object.entries(sent.events || {})) {
      now.events[k] = Math.max(0, (now.events[k] || 0) - v);
      if (!now.events[k]) delete now.events[k];
    }
    now.activeSec = Math.max(0, (now.activeSec || 0) - Math.round(sent.activeSec || 0));
    if (now.lastError === sent.lastError) now.lastError = '';
    now.recCount = Math.max(0, now.recCount - sent.recCount);
    now.recSeconds = Math.max(0, now.recSeconds - Math.round(sent.recSeconds));
    save(now);
    return true;
  } catch {
    try { const s = load(); s.lastReport = 0; save(s); } catch { /* ignore */ }
    try { scheduleRetry(accessToken, version, noteSendFailure(0)); } catch { /* ignore */ }
    return false;
  }
}

// If the app stays open, try again once the wait is over (at most one timer at a time; capped at 30 minutes so
// the sign-in is still fresh). If the app is closed, the next open tries again on its own.
let retryTimer = null;
function scheduleRetry(accessToken, version, waitMs = backoffRemainingMs()) {
  if (retryTimer) return;
  retryTimer = setTimeout(() => { retryTimer = null; reportUsage(accessToken, version); }, Math.min(30 * 60000, Math.max(30000, waitMs)) + 1000);
}
