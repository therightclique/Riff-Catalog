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
import { loadCounters, saveCounters, noteTabView, noteRecording, noteEvent, installErrorCapture, installActiveTimer, flushActive } from './UsageCounters';

export { noteTabView, noteRecording, noteEvent, installErrorCapture, installActiveTimer };

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
  if ((m = /OS (\d+)[_.](\d+)/.exec(ua)) && /iPhone|iPad|iPod/.test(ua)) out.os = `iOS ${m[1]}.${m[2]}`;
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
    timeZone: tz,
    language: navigator.language || '',
  };
}

// Sends one report. Never throws and never blocks the app; if anything fails
// the counts stay on the device and go out with the next report.
export async function reportUsage(accessToken, version) {
  try {
    if (!accessToken || !navigator.onLine) return false;
    const before = load();
    if (Date.now() - before.lastReport < MIN_GAP_MS) return false;
    before.lastReport = Date.now();   // claim the slot first so two quick calls can't both send
    save(before);

    const [clips, ideas] = await Promise.all([
      fetchClips(accessToken).then(f => (Array.isArray(f) ? f.length : null)).catch(() => null),
      listTextFiles(accessToken, 'Randomizer').then(f => (Array.isArray(f) ? f.length : null)).catch(() => null),
    ]);

    flushActive();
    const sent = load();   // counts as of this moment; whatever arrives while the request is out stays pending
    const pending = await pendingCount();
    const body = {
      accessToken,
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
      delta: { tabs: sent.tabs, events: sent.events, activeSec: Math.round(sent.activeSec || 0), recCount: sent.recCount, recSeconds: Math.round(sent.recSeconds) },
    };
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const s = load(); s.lastReport = 0; save(s);   // allow a retry on the next open
      return false;
    }
    // Success: take off exactly what was sent.
    const now = load();
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
    return false;
  }
}
