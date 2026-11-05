// Riff Catalog usage reporting.
//
// What leaves the device: counts and dates only - how many clips and song ideas
// exist, how many custom beats are saved, how often each section is opened, and
// how long the recordings made in the app were on average. Never clip names,
// lyrics, notes, idea text, beat patterns or any audio. The About > Privacy
// Policy tab lists exactly this, so keep the two in step.
//
// The app opens -> one small report -> one row per person in the owner's
// spreadsheet is updated (see netlify/functions/log-usage.mjs).

import { fetchClips } from './DriveLibrary';
import { listTextFiles } from './DriveUploader';

const STORE = 'rc_usage_v1';
const ENDPOINT = '/.netlify/functions/log-usage';
const MIN_GAP_MS = 15 * 60 * 1000;   // reopening within 15 minutes counts as the same visit

const empty = () => ({ tabs: {}, recCount: 0, recSeconds: 0, lastReport: 0 });

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    return { ...empty(), ...(s && typeof s === 'object' ? s : {}) };
  } catch { return empty(); }
}
function save(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* reporting is best-effort */ } }

// Called whenever a section is opened.
export function noteTabView(tab) {
  if (typeof tab !== 'string') return;
  const s = load();
  s.tabs[tab] = (s.tabs[tab] || 0) + 1;
  save(s);
}

// Called when a recording is saved (to Drive or to the device). Seconds only.
export function noteRecording(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const s = load();
  s.recCount += 1;
  s.recSeconds += seconds;
  save(s);
}

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
  try {
    const list = JSON.parse(localStorage.getItem('rc_jam_beats') || '[]');
    return Array.isArray(list) ? list.length : 0;
  } catch { return null; }
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

    const sent = load();   // counts as of this moment; whatever arrives while the request is out stays pending
    const body = {
      accessToken,
      version,
      device: deviceKind(),
      installed: isInstalled(),
      clipCount: clips,
      ideaCount: ideas,
      beatCount: beatCount(),
      delta: { tabs: sent.tabs, recCount: sent.recCount, recSeconds: Math.round(sent.recSeconds) },
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
    now.recCount = Math.max(0, now.recCount - sent.recCount);
    now.recSeconds = Math.max(0, now.recSeconds - Math.round(sent.recSeconds));
    save(now);
    return true;
  } catch {
    try { const s = load(); s.lastReport = 0; save(s); } catch { /* ignore */ }
    return false;
  }
}
