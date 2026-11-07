// Riff Catalog - usage logger.
//
// The app sends a small summary (counts and dates only - never clip names,
// lyrics, notes, idea text or beat patterns) each time it is opened while
// signed in. This function:
//   1. checks the Google sign-in token really belongs to a Riff Catalog user
//      and reads the user's email from Google itself (the app's claim is never trusted),
//   2. keeps exactly ONE row per email in the "Riff Catalog Usage" spreadsheet,
//      creating it the first time and updating it afterwards.
// The sign-in token is used for the check and then thrown away; it is never stored.

import { createSign } from 'node:crypto';
import { DAILY, IMG_KEY_RE, IMAGES_PER_MESSAGE, bumpDaily, dailySweep, tooFast, who } from './lib/limits.mjs';

const CLIENT_ID = '495492558072-8ohvj2v3npv2coeq1alndbh0g0lk95s2.apps.googleusercontent.com';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

// Tabs we count (must match the view ids in the app) and their spreadsheet labels.
const TABS_BASE = [
  ['record', 'Record'], ['library', 'Library'], ['keyfinder', 'Key Finder'], ['practice', 'Practice'],
  ['randomizer', 'Randomizer'], ['jam', 'Jam'], ['settings', 'Settings'], ['about', 'About'],
  ['changelog', 'Changelog'], ['debug', 'Debug'],
];
// Added later: their columns go on the END of the sheet so existing columns never move.
const TABS_LATE = [['dashboard', 'Dashboard'], ['feedback', 'Feedback']];
const TABS = [...TABS_BASE, ...TABS_LATE];
const DEVICES = ['iPhone', 'iPad', 'Android phone', 'Android tablet', 'Windows', 'Mac', 'Linux', 'ChromeOS', 'Other'];

// Column layout. One place to change if columns are added later: new columns go on the END.
const COLS = [
  'Email', 'First login (PT)', 'Last login (PT)', 'Last IP', 'Country', 'Region',
  'Clip library size', 'Avg recording length (sec)', 'Most used tab', 'Custom drum beats', 'Song ideas saved',
  'Sessions', 'App version', 'Device', 'Installed app',
  ...TABS_BASE.map(([, label]) => `Views: ${label}`),
  'Recordings counted', 'Recording seconds counted',
  'OS version', 'Device model', 'Screen', 'Browser',
  'Offline clips waiting', 'Upload failures', 'Settings save failures', 'App errors', 'Last error type',
  'Active minutes', 'Days active',
  'Jam plays', 'Practice picks', 'Key Finder lookups', 'Wheel spins', 'Surprise me uses', 'Ideas saved (saves)', 'Multi-key ideas saved',
  'Theme', 'Note names', 'Custom note colors', 'Strum speed', 'Time zone', 'Language',
  'Clips with key', 'Clips with tempo', 'Clips with tags',
  'Root note color', '3rd note color', '5th note color', 'Other note color',
  // first-use milestones (set once, never overwritten)
  'First recording (PT)', 'First Drive save (PT)', 'First Library open (PT)', 'First Jam play (PT)', 'First Key Finder use (PT)',
  'First Practice use (PT)', 'First Randomizer use (PT)', 'First idea saved (PT)', 'First feedback sent (PT)',
  // speed and reliability
  'Drive list ms (last)', 'Avg upload (sec)', 'Uploads timed', 'Upload seconds total', 'Drive reconnects needed', 'Mic denied', 'Mic errors (other)', 'Audio blocked',
  // library tool use
  'Library filter uses', 'Library sort changes', 'Clip plays',
  // when and how long people record (the user's own clock)
  'Recorded: morning', 'Recorded: afternoon', 'Recorded: evening', 'Recorded: night', 'Recorded: weekday', 'Recorded: weekend',
  'Takes under 30s', 'Takes 30s-2min', 'Takes 2-5min', 'Takes over 5min',
  // install and update health
  'Sessions installed', 'Sessions in browser', 'Previous version', 'Version updated (PT)', 'Device storage used (MB)',
  // sections added later
  ...TABS_LATE.map(([, label]) => `Views: ${label}`),
];
const MILESTONES = {
  recording: 'First recording (PT)', driveSave: 'First Drive save (PT)', library: 'First Library open (PT)', jam: 'First Jam play (PT)',
  keyfinder: 'First Key Finder use (PT)', practice: 'First Practice use (PT)', randomizer: 'First Randomizer use (PT)',
  idea: 'First idea saved (PT)', feedback: 'First feedback sent (PT)',
};
const AREAS = ['upload', 'sync', 'settings', 'mic', 'audio', 'analysis', 'app', 'drive', 'library', 'recorder'];
// Counted events the app may send, and the column each one adds to.
const EVENT_COLS = {
  uploadFail: 'Upload failures', settingsFail: 'Settings save failures', errors: 'App errors',
  jamPlay: 'Jam plays', practicePick: 'Practice picks', keyLookup: 'Key Finder lookups', spin: 'Wheel spins',
  surprise: 'Surprise me uses', idea: 'Ideas saved (saves)', ideaMultiKey: 'Multi-key ideas saved',
  reauth: 'Drive reconnects needed', micDenied: 'Mic denied', micError: 'Mic errors (other)', audioFail: 'Audio blocked',
  libFilter: 'Library filter uses', libSort: 'Library sort changes', clipPlay: 'Clip plays',
  recMorning: 'Recorded: morning', recAfternoon: 'Recorded: afternoon', recEvening: 'Recorded: evening', recNight: 'Recorded: night',
  recWeekday: 'Recorded: weekday', recWeekend: 'Recorded: weekend',
  recShort: 'Takes under 30s', recMedium: 'Takes 30s-2min', recLong: 'Takes 2-5min', recVeryLong: 'Takes over 5min',
};
const THEMES = ['light', 'dark', 'match device'];
const IDX = Object.fromEntries(COLS.map((name, i) => [name, i]));
const TAB_COL = (id) => IDX[`Views: ${TABS.find(([k]) => k === id)[1]}`];

export const _internals = { COLS, TABS, resetBusy: () => { busyUntil = 0; lastPing.clear(); } };

// ── Google auth for the spreadsheet (service account) ───────────────────

const b64url = (v) => Buffer.from(v).toString('base64url');
let cachedToken = null; // { token, exp } - reused while this server instance stays warm

async function serviceToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signature = createSign('RSA-SHA256').update(`${header}.${claim}`).sign(creds.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${signature}` }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`service sign-in failed (${res.status})`);
  cachedToken = { token: body.access_token, exp: now + (body.expires_in || 3600) };
  return cachedToken.token;
}

// ── Who is calling? ─────────────────────────────────────────────────────

export async function verifyUser(accessToken) {
  // 1) Was this token issued to Riff Catalog, with Drive access, and still valid?
  const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  if (!infoRes.ok) return null;
  const info = await infoRes.json().catch(() => null);
  if (!info || (info.aud !== CLIENT_ID && info.azp !== CLIENT_ID)) return null;
  if (!String(info.scope || '').includes('drive.file')) return null;
  // 2) Ask Google who the token belongs to.
  const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!aboutRes.ok) return null;
  const about = await aboutRes.json().catch(() => null);
  const email = about?.user?.emailAddress;
  return typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;
}

// Short free-text facts about the device. Anything odd is dropped rather than stored.
const shortText = (v, re) => (typeof v === 'string' && v.trim() && re.test(v.trim()) ? v.trim() : null);
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const TZ_RE = /^[A-Za-z_\/+\-0-9]{1,40}$/, LANG_RE = /^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8}){0,2}$/, ERR_RE = /^[A-Za-z]{3,30}$/;
const OS_RE = /^[\w .\-+()]{1,30}$/, MODEL_RE = /^[\w .\-+()\/,]{1,80}$/, SCREEN_RE = /^\d{2,5}x\d{2,5}@\d{1,2}(\.\d{1,2})?$/, BROWSER_RE = /^[\w .\-+()]{1,30}$/;

const goodDate = (v) => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) && t > Date.parse('2024-01-01') && t < Date.now() + 86400000 ? new Date(t) : null;
};
function cleanMilestones(m) {
  const out = {};
  if (m && typeof m === 'object') for (const k of Object.keys(MILESTONES)) { const d = goodDate(m[k]); if (d) out[k] = d; }
  return out;
}
const CODE_RE = /^[A-Za-z0-9 :._\-]{1,40}$/;
export function cleanProblems(list) {
  const out = [];
  for (const x of Array.isArray(list) ? list.slice(0, 20) : []) {
    if (!x || typeof x !== 'object') continue;
    const d = goodDate(x.t);
    if (!d || !AREAS.includes(x.area) || typeof x.code !== 'string' || !CODE_RE.test(x.code)) continue;
    out.push({ d, area: x.area, code: x.code, view: TABS.some(([k]) => k === x.view) ? x.view : '', n: count(x.n, 999) || 1 });
  }
  return out;
}

// ── Clean up what the app sent ──────────────────────────────────────────

const count = (v, max = 1e6) => (Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), max) : null);

export function cleanPayload(body) {
  const delta = body?.delta && typeof body.delta === 'object' ? body.delta : {};
  const tabs = {};
  for (const [id] of TABS) {
    const n = count(delta.tabs?.[id], 100000);
    if (n) tabs[id] = n;
  }
  const version = typeof body?.version === 'string' && /^[\w.\- ]{1,24}$/.test(body.version) ? body.version : null;
  return {
    clipCount: count(body?.clipCount, 100000),
    ideaCount: count(body?.ideaCount, 100000),
    beatCount: count(body?.beatCount, 100000),
    version,
    device: DEVICES.includes(body?.device) ? body.device : null,
    installed: typeof body?.installed === 'boolean' ? body.installed : null,
    os: shortText(body?.os, OS_RE),
    model: shortText(body?.model, MODEL_RE),
    screen: shortText(body?.screen, SCREEN_RE),
    browser: shortText(body?.browser, BROWSER_RE),
    tabs,
    pending: count(body?.pendingClips, 100000),
    lib: {
      key: count(body?.library?.withKey, 100000), tempo: count(body?.library?.withTempo, 100000), tags: count(body?.library?.withTags, 100000),
    },
    theme: THEMES.includes(body?.choices?.theme) ? body.choices.theme : null,
    accidentals: ['Sharps', 'Flats'].includes(body?.choices?.accidentals) ? body.choices.accidentals : null,
    strum: Number.isFinite(body?.choices?.strum) && body.choices.strum >= 0 && body.choices.strum <= 10 ? Math.round(body.choices.strum * 100) / 100 : null,
    colors: Object.fromEntries(['root', 'third', 'fifth', 'other'].map(k => [k, shortText(body?.choices?.colors?.[k], HEX_RE)?.toUpperCase() || null])),
    customColors: typeof body?.choices?.customColors === 'boolean' ? body.choices.customColors : null,
    timeZone: shortText(body?.choices?.timeZone, TZ_RE),
    language: shortText(body?.choices?.language, LANG_RE),
    lastError: shortText(body?.lastError, ERR_RE),
    events: Object.fromEntries(Object.keys(EVENT_COLS).map(k => [k, count(delta.events?.[k], 100000) || 0]).filter(([, n]) => n)),
    activeSec: count(delta.activeSec, 1e6) || 0,
    milestones: cleanMilestones(body?.milestones),
    driveListMs: count(body?.driveListMs, 600000),
    storageMB: count(body?.storageMB, 1e7),
    uploadCount: count(delta.upload?.count, 100000) || 0,
    uploadSec: count(delta.upload?.sec, 1e7) || 0,
    problems: cleanProblems(body?.problems),
    recCount: count(delta.recCount, 100000) || 0,
    recSeconds: count(delta.recSeconds, 1e7) || 0,
  };
}

// ── Build the row ───────────────────────────────────────────────────────

const ptNow = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Los_Angeles', dateStyle: 'short', timeStyle: 'medium' }).format(d);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export function buildRow(existing, email, p, where) {
  const row = COLS.map((_, i) => (existing && existing[i] !== undefined ? existing[i] : ''));
  const stamp = ptNow();
  const prevDay = String(row[IDX['Last login (PT)']] || '').slice(0, 10);
  const today = stamp.slice(0, 10);
  row[IDX['Days active']] = (num(row[IDX['Days active']]) || (prevDay ? 1 : 0)) + (prevDay !== today ? 1 : 0);
  const oldVersion = String(row[IDX['App version']] || '');
  Object.defineProperty(row, '_newDay', { value: prevDay !== today, enumerable: false });
  row[IDX['Email']] = email;
  if (!row[IDX['First login (PT)']]) row[IDX['First login (PT)']] = stamp;
  row[IDX['Last login (PT)']] = stamp;
  row[IDX['Last IP']] = where.ip || row[IDX['Last IP']];
  row[IDX['Country']] = where.country || row[IDX['Country']];
  row[IDX['Region']] = where.region || row[IDX['Region']];
  if (p.clipCount !== null) row[IDX['Clip library size']] = p.clipCount;
  if (p.beatCount !== null) row[IDX['Custom drum beats']] = p.beatCount;
  if (p.ideaCount !== null) row[IDX['Song ideas saved']] = p.ideaCount;
  row[IDX['Sessions']] = num(row[IDX['Sessions']]) + 1;
  if (p.version) row[IDX['App version']] = p.version;
  if (p.device) row[IDX['Device']] = p.device;
  if (p.installed !== null) row[IDX['Installed app']] = p.installed ? 'Yes' : 'No';
  if (p.os) row[IDX['OS version']] = p.os;
  if (p.model) row[IDX['Device model']] = p.model;
  if (p.screen) row[IDX['Screen']] = p.screen;
  if (p.browser) row[IDX['Browser']] = p.browser;
  if (p.pending !== null) row[IDX['Offline clips waiting']] = p.pending;
  if (p.lastError) row[IDX['Last error type']] = p.lastError;
  if (p.theme) row[IDX['Theme']] = p.theme;
  if (p.accidentals) row[IDX['Note names']] = p.accidentals;
  for (const [k, label] of [['root', 'Root note color'], ['third', '3rd note color'], ['fifth', '5th note color'], ['other', 'Other note color']]) {
    if (p.colors[k]) row[IDX[label]] = p.colors[k];
  }
  if (p.customColors !== null) row[IDX['Custom note colors']] = p.customColors ? 'Yes' : 'No';
  if (p.strum !== null) row[IDX['Strum speed']] = p.strum;
  if (p.timeZone) row[IDX['Time zone']] = p.timeZone;
  if (p.language) row[IDX['Language']] = p.language;
  if (p.lib.key !== null) row[IDX['Clips with key']] = p.lib.key;
  if (p.lib.tempo !== null) row[IDX['Clips with tempo']] = p.lib.tempo;
  if (p.lib.tags !== null) row[IDX['Clips with tags']] = p.lib.tags;
  for (const [k, col] of Object.entries(EVENT_COLS)) {
    const total = num(row[IDX[col]]) + (p.events[k] || 0);
    row[IDX[col]] = total || '';
  }
  // Milestones: the first time only, never overwritten.
  for (const [k, label] of Object.entries(MILESTONES)) {
    if (p.milestones[k] && !row[IDX[label]]) row[IDX[label]] = ptNow(p.milestones[k]);
  }
  if (p.driveListMs !== null) row[IDX['Drive list ms (last)']] = p.driveListMs;
  if (p.storageMB !== null) row[IDX['Device storage used (MB)']] = p.storageMB;
  if (p.uploadCount) {
    const n = num(row[IDX['Uploads timed']]) + p.uploadCount, sec = num(row[IDX['Upload seconds total']]) + p.uploadSec;
    row[IDX['Uploads timed']] = n; row[IDX['Upload seconds total']] = sec; row[IDX['Avg upload (sec)']] = Math.round((sec / n) * 10) / 10;
  }
  if (p.installed !== null) {
    const col = IDX[p.installed ? 'Sessions installed' : 'Sessions in browser'];
    row[col] = num(row[col]) + 1;
  }
  // Update health: when the app version changes, remember the one before and when.
  if (p.version && oldVersion && oldVersion !== p.version) { row[IDX['Previous version']] = oldVersion; row[IDX['Version updated (PT)']] = stamp; }
  // Active minutes: running total of time with the app on screen.
  if (p.activeSec) row[IDX['Active minutes']] = Math.round((num(row[IDX['Active minutes']]) + p.activeSec / 60) * 10) / 10;

  // Running totals: this device's counts since its last report are added on.
  let best = null;
  for (const [id, label] of TABS) {
    const col = TAB_COL(id);
    const total = num(row[col]) + (p.tabs[id] || 0);
    row[col] = total || '';
    if (total > 0 && (!best || total > best.total)) best = { label, total };
  }
  row[IDX['Most used tab']] = best ? best.label : '';

  const recCount = num(row[IDX['Recordings counted']]) + p.recCount;
  const recSeconds = num(row[IDX['Recording seconds counted']]) + p.recSeconds;
  row[IDX['Recordings counted']] = recCount || '';
  row[IDX['Recording seconds counted']] = recSeconds ? Math.round(recSeconds) : '';
  row[IDX['Avg recording length (sec)']] = recCount ? Math.round(recSeconds / recCount) : '';
  return row;
}

// ── Spreadsheet access ──────────────────────────────────────────────────

let sheetInfo = null; // { title, gid } - looked up once per warm instance

// Google limits how many Sheets requests one account can make per minute (60 reads and 60 writes for this app).
// A refused request (429) or a Google hiccup (5xx) is retried a couple of times with a short, slightly random
// wait. If Google is still refusing, the error is marked "busy" so the app is told to try again later instead
// of failing, and for the next 20 seconds routine reports are turned away early to give Google room to recover.
const RETRY_MS = Number(process.env.SHEETS_RETRY_MS ?? 700);
const RETRIES = 2;
let busyUntil = 0;
const lastPing = new Map();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function sheetsFetch(token, url, init = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return body;
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < RETRIES) {
      const ra = Math.min(3000, Number(res.headers?.get?.('retry-after') || 0) * 1000);
      await sleep(Math.max(ra, RETRY_MS * (attempt + 1)) + Math.random() * RETRY_MS * 0.4);
      continue;
    }
    const err = new Error(`Sheets ${res.status}: ${body.error?.message || 'error'}`);
    if (res.status === 429) { err.busy = true; busyUntil = Date.now() + 20000; }
    throw err;
  }
}

// The sheet tabs are found by name: "Stats" (one row per person) and "Feedback" (one row per submission).
// If "Stats" isn't there, the first tab is used so the logger keeps working.
async function getSheetInfo(token, sheetId) {
  if (sheetInfo && sheetInfo.sheetId === sheetId) return sheetInfo;
  const meta = await sheetsFetch(token, `${SHEETS}/${encodeURIComponent(sheetId)}?fields=sheets.properties(title,sheetId)`);
  const tabs = (meta.sheets || []).map(s => s.properties);
  const stats = tabs.find(t => String(t.title).trim().toLowerCase() === 'stats') || tabs[0];
  if (!stats) throw new Error('spreadsheet has no tabs');
  sheetInfo = { sheetId, title: stats.title, gid: stats.sheetId, tabs };
  return sheetInfo;
}

// Extra tabs (Feedback, Errors, History, Diagnostics) are found by name and created if missing.
// Each tab's header row is written once per warm server instance, so new columns appear on their own.
const tabTitles = {};
const tabHeaderDone = {};
// Looks a tab up by name; if it isn't in the remembered list (another server instance may have just made it), asks Google once more.
async function findTab(token, sheetId, name) {
  const match = (info) => info.tabs.find(t => String(t.title).trim().toLowerCase() === name.toLowerCase());
  let found = match(await getSheetInfo(token, sheetId));
  if (!found) { sheetInfo = null; found = match(await getSheetInfo(token, sheetId)); }
  return found || null;
}
async function getTab(token, sheetId, name, header) {
  if (!tabTitles[name]) {
    const found = await findTab(token, sheetId, name);
    if (found) tabTitles[name] = found.title;
    else {
      await sheetsFetch(token, `${SHEETS}/${encodeURIComponent(sheetId)}:batchUpdate`, {
        method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: name } } }] }),
      });
      tabTitles[name] = name;
    }
  }
  const title = tabTitles[name];
  if (!tabHeaderDone[name]) {
    await sheetsFetch(token, rangeUrl(sheetId, title, `A1:${colLetter(header.length - 1)}1`, '?valueInputOption=RAW'), {
      method: 'PUT', body: JSON.stringify({ values: [header] }),
    });
    tabHeaderDone[name] = true;
  }
  return title;
}
async function appendRows(token, sheetId, name, header, rows) {
  if (!rows.length) return;
  const title = await getTab(token, sheetId, name, header);
  await sheetsFetch(token, rangeUrl(sheetId, title, 'A1', ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS'), {
    method: 'POST', body: JSON.stringify({ values: rows }),
  });
}

const rangeUrl = (sheetId, title, a1, suffix = '') => `${SHEETS}/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(`'${title}'!${a1}`)}${suffix}`;
const colLetter = (n) => { let s = ''; for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const LAST_COL = colLetter(COLS.length - 1);

async function emailRows(token, sheetId, title) {
  const body = await sheetsFetch(token, rangeUrl(sheetId, title, 'A:A'));
  return (body.values || []).map(r => String(r[0] || '').trim().toLowerCase());
}

let headerWritten = false; // the header row is (re)written once per warm server instance, so newly added columns get their titles
async function ensureHeader(token, sheetId, title, firstCell) {
  if (firstCell === 'email' && headerWritten) return;
  headerWritten = true;
  await sheetsFetch(token, rangeUrl(sheetId, title, `A1:${LAST_COL}1`, '?valueInputOption=RAW'), {
    method: 'PUT', body: JSON.stringify({ values: [COLS] }),
  });
}

const HISTORY_COLS = ['Date (PT)', 'Email', 'Clip library size', 'Song ideas saved', 'Custom drum beats', 'Sessions', 'Active minutes', 'Days active', 'Clips with key', 'Clips with tempo', 'Clips with tags', 'App version'];
const ERROR_COLS = ['Date (PT)', 'Email', 'App version', 'Device', 'OS version', 'Area', 'Code', 'Screen', 'Times'];

// Once per person per day, one line of history; plus any problems the app logged. Neither can fail the main report.
async function afterStatsWrite(token, sheetId, email, row, p, where) {
  try {
    if (row._newDay) {
      const g = (n) => row[IDX[n]] ?? '';
      await appendRows(token, sheetId, 'History', HISTORY_COLS, [[ptNow(), email, g('Clip library size'), g('Song ideas saved'), g('Custom drum beats'), g('Sessions'), g('Active minutes'), g('Days active'), g('Clips with key'), g('Clips with tempo'), g('Clips with tags'), g('App version')]]);
    }
  } catch (e) { console.error('history append failed:', e.message); }
  try {
    if (p.problems.length) {
      await appendRows(token, sheetId, 'Errors', ERROR_COLS, p.problems.map(x => [ptNow(x.d), email, p.version || row[IDX['App version']] || '', p.device || row[IDX['Device']] || '', p.os || row[IDX['OS version']] || '', x.area, x.code, x.view, x.n]));
    }
  } catch (e) { console.error('error log append failed:', e.message); }
}

// Remembers which sheet row belongs to each email, so a returning person's report skips reading the whole email column.
// Every use is double-checked against the row's own email, so rows that moved (a duplicate removed) just fall back to a full lookup.
const rowCache = new Map();
const remember = (email, n) => { if (rowCache.size > 5000) rowCache.clear(); if (n > 0) rowCache.set(email, n); };

export async function upsertUser({ token, sheetId, email, payload, where }) {
  const { title, gid } = await getSheetInfo(token, sheetId);
  let rowNum = 0, current = null;
  const hint = headerWritten ? rowCache.get(email) : 0;
  if (hint) {
    const cur = await sheetsFetch(token, rangeUrl(sheetId, title, `A${hint}:${LAST_COL}${hint}`));
    const got = cur.values?.[0];
    if (got && String(got[0] || '').trim().toLowerCase() === email) { rowNum = hint; current = got; }
    else rowCache.delete(email);
  }
  if (!rowNum) {
    let emails = await emailRows(token, sheetId, title);
    await ensureHeader(token, sheetId, title, emails[0]);
    if (emails[0] !== 'email') emails = ['email', ...emails.slice(1)];
    rowNum = emails.indexOf(email, 1) + 1; // 1-based sheet row; 0 when not found
    if (rowNum > 0) {
      const cur = await sheetsFetch(token, rangeUrl(sheetId, title, `A${rowNum}:${LAST_COL}${rowNum}`));
      current = cur.values?.[0] || null;
    }
  }

  if (rowNum > 0) {
    const row = buildRow(current, email, payload, where);
    await sheetsFetch(token, rangeUrl(sheetId, title, `A${rowNum}:${LAST_COL}${rowNum}`, '?valueInputOption=RAW'), {
      method: 'PUT', body: JSON.stringify({ values: [row] }),
    });
    remember(email, rowNum);
    await afterStatsWrite(token, sheetId, email, row, payload, where);
    return { row: rowNum, created: false };
  }

  const row = buildRow(null, email, payload, where);
  const out = await sheetsFetch(token, rangeUrl(sheetId, title, 'A1', ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS'), {
    method: 'POST', body: JSON.stringify({ values: [row] }),
  });
  const m = /!A(\d+)/.exec(out.updates?.updatedRange || '');
  rowNum = m ? Number(m[1]) : 0;
  remember(email, rowNum);

  // Two first-time reports from the same person at the same instant (e.g. two
  // devices) could each add a row. Check once and remove any extras so the
  // email stays on exactly one line.
  await removeDuplicates(token, sheetId, title, gid, email);
  await afterStatsWrite(token, sheetId, email, row, payload, where);
  return { row: rowNum, created: true };
}

async function removeDuplicates(token, sheetId, title, gid, email) {
  const emails = await emailRows(token, sheetId, title);
  const rows = emails.map((e, i) => (e === email && i > 0 ? i + 1 : 0)).filter(Boolean);
  if (rows.length < 2) return;
  // Re-read right before deleting so a row another request already removed is not deleted twice.
  const fresh = await emailRows(token, sheetId, title);
  const extras = fresh.map((e, i) => (e === email && i > 0 ? i + 1 : 0)).filter(Boolean).slice(1).reverse();
  if (!extras.length) return;
  await sheetsFetch(token, `${SHEETS}/${encodeURIComponent(sheetId)}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: extras.map(r => ({ deleteDimension: { range: { sheetId: gid, dimension: 'ROWS', startIndex: r - 1, endIndex: r } } })) }),
  });
}

// ── Feedback (one new row per submission; nothing is ever updated or removed) ──

const FEEDBACK_COLS = ['Date (PT)', 'Email', 'Rating', 'Feedback', 'Country', 'Region', 'App version', 'Liked', 'Disliked', 'Feature ideas'];
const DIAG_COLS = ['Date (PT)', 'Email', 'Note', 'App version', 'Device', 'OS version', 'Browser', 'Screen', 'Installed app', 'Online', 'Offline clips waiting', 'Device storage used (MB)', 'Country', 'Region', 'Recent problems'];

const cleanText = (v, max) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim().slice(0, max) : '');

export function cleanFeedback(body) {
  const r = Number(body?.rating);
  const rating = Number.isFinite(r) && r >= 0.5 && r <= 5 && Math.round(r * 2) === r * 2 ? r : null;
  const version = typeof body?.version === 'string' && /^[\w.\- ]{1,24}$/.test(body.version) ? body.version : '';
  return { rating, text: cleanText(body?.text, 2000), liked: cleanText(body?.liked, 1000), disliked: cleanText(body?.disliked, 1000), ideas: cleanText(body?.ideas, 1000), version };
}

export async function addFeedback({ token, sheetId, email, fb, where }) {
  await appendRows(token, sheetId, 'Feedback', FEEDBACK_COLS, [[ptNow(), email, fb.rating, fb.text, where.country, where.region, fb.version, fb.liked, fb.disliked, fb.ideas]]);
}

// A report the person chose to send from the Debug screen: device facts plus our own short problem codes. No console text.
const PROBLEM_LINE_RE = /^[A-Za-z0-9 :._@>\-]{1,70}$/;
export function cleanDiagnostic(body) {
  const lines = (Array.isArray(body?.problems) ? body.problems.slice(0, 50) : []).filter(l => typeof l === 'string' && PROBLEM_LINE_RE.test(l));
  return {
    note: cleanText(body?.note, 500),
    version: typeof body?.version === 'string' && /^[\w.\- ]{1,24}$/.test(body.version) ? body.version : '',
    device: DEVICES.includes(body?.device) ? body.device : '',
    os: shortText(body?.os, OS_RE) || '', browser: shortText(body?.browser, BROWSER_RE) || '', screen: shortText(body?.screen, SCREEN_RE) || '',
    installed: typeof body?.installed === 'boolean' ? (body.installed ? 'Yes' : 'No') : '',
    online: typeof body?.online === 'boolean' ? (body.online ? 'Yes' : 'No') : '',
    pending: count(body?.pendingClips, 100000), storageMB: count(body?.storageMB, 1e7),
    lines,
  };
}
export async function addDiagnostic({ token, sheetId, email, d, where }) {
  await appendRows(token, sheetId, 'Diagnostics', DIAG_COLS, [[ptNow(), email, d.note, d.version, d.device, d.os, d.browser, d.screen, d.installed, d.online, d.pending ?? '', d.storageMB ?? '', where.country, where.region, d.lines.join('\n')]]);
}

// ── Support requests: a message the person chose to send from Support > Contact support ──
// One row each, in the "Support" tab. Status starts as "New" (unread); the owner marks it Read from the dashboard
// or by typing anything other than New in the Status column. The ID in column A is how a request is found again.
const SUPPORT_COLS = ['ID', 'Date (PT)', 'Email', 'Status', 'Message', 'App version', 'Device', 'OS version', 'Browser', 'Screen', 'Online', 'Offline clips waiting', 'Recent problems', 'Country', 'Region', 'Screenshots', 'Tags', 'Archived'];
// Tags the owner can put on a request (people see them on their own Dashboard but can't change them). Stored in the Tags
// column as a comma-separated list. "Archived" is "Yes" or empty; archiving only hides a request from the dashboard's main list.
export const SUPPORT_TAGS = ['Bug', 'Feature request', 'Question', 'In progress', 'On hold', 'Needs more info', 'Resolved', 'Do not fix', 'Duplicate'];
const SUPPORT_TAGS_COL = SUPPORT_COLS.indexOf('Tags');
const SUPPORT_ARCHIVED_COL = SUPPORT_COLS.indexOf('Archived');
const SUPPORT_STATUS_COL = SUPPORT_COLS.indexOf('Status');
const ID_RE = /^S[0-9a-z]{6,20}$/;
export function cleanSupport(body) {
  const d = cleanDiagnostic(body);
  const message = cleanText(body?.message, 2000);
  const withDetails = body?.details === true;
  // Screenshot keys the app got back from the upload step; anything that doesn't look like one is dropped.
  const images = [...new Set((Array.isArray(body?.images) ? body.images : []).filter(k => typeof k === 'string' && IMG_KEY_RE.test(k)))].slice(0, IMAGES_PER_MESSAGE);
  return withDetails ? { ...d, message, details: true, images } : { message, details: false, version: d.version, lines: [], device: '', os: '', browser: '', screen: '', online: '', pending: null, images };
}
export async function addSupport({ token, sheetId, email, d, where }) {
  const id = 'S' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await appendRows(token, sheetId, 'Support', SUPPORT_COLS, [[id, ptNow(), email, 'New', d.message, d.version, d.device, d.os, d.browser, d.screen, d.online, d.pending ?? '', d.lines.join('\n'), where.country, where.region, (d.images || []).join(','), '', '']]);
  return id;
}
const isUnread = (status) => { const t = String(status ?? '').trim().toLowerCase(); return t === '' || t === 'new'; };

// How many requests are unread, and when the newest arrived. Reads only the columns needed.
export async function supportUnread({ token, sheetId }) {
  const found = await findTab(token, sheetId, 'Support');
  if (!found) return { unread: 0, newest: '' };
  const body = await sheetsFetch(token, rangeUrl(sheetId, found.title, 'A2:D5000'));
  const rows = (body.values || []).filter(r => String(r[0] || '').trim());
  const open = rows.filter(r => isUnread(r[SUPPORT_STATUS_COL]));
  return { unread: open.length, newest: open.length ? String(open[open.length - 1][1] || '') : '' };
}

// Marks requests Read. `ids` are request IDs; "all" marks every unread one. Anything else in Status is left alone.
export async function markSupportRead({ token, sheetId, ids, all }) {
  const found = await findTab(token, sheetId, 'Support');
  if (!found) return 0;
  const body = await sheetsFetch(token, rangeUrl(sheetId, found.title, 'A2:D5000'));
  const rows = body.values || [];
  const want = new Set((Array.isArray(ids) ? ids : []).filter(x => typeof x === 'string' && ID_RE.test(x)).slice(0, 100));
  const hits = [];
  rows.forEach((r, i) => { if (String(r[0] || '').trim() && isUnread(r[SUPPORT_STATUS_COL]) && (all === true || want.has(String(r[0]).trim()))) hits.push(i + 2); });
  for (const n of hits) {
    await sheetsFetch(token, rangeUrl(sheetId, found.title, `D${n}`, '?valueInputOption=RAW'), { method: 'PUT', body: JSON.stringify({ values: [['Read']] }) });
  }
  return hits.length;
}

// Keeps only tags from the allowed list (any spelling of case), once each, in the list's own order.
export function cleanTags(list) {
  const want = new Set((Array.isArray(list) ? list : []).filter(x => typeof x === 'string').map(x => x.trim().toLowerCase()));
  return SUPPORT_TAGS.filter(t => want.has(t.toLowerCase()));
}
const isArchived = (v) => String(v ?? '').trim().toLowerCase() === 'yes';

// The owner changes a request's tags and/or archives it. Only the fields given are changed. Archiving also marks an
// unread request Read, so it never leaves a "new" count behind. Returns what the row now holds, or null if no such request.
export async function updateSupport({ token, sheetId, id, tags, archived }) {
  const rid = String(id || '').trim();
  if (!ID_RE.test(rid)) return null;
  const title = await getTab(token, sheetId, 'Support', SUPPORT_COLS);   // makes sure the Tags and Archived headings exist
  const body = await sheetsFetch(token, rangeUrl(sheetId, title, 'A2:R20000'));
  const rows = body.values || [];
  const at = rows.findIndex(r => String(r[0] || '').trim() === rid);
  if (at < 0) return null;
  const n = at + 2, row = rows[at];
  const out = { id: rid, tags: String(row[SUPPORT_TAGS_COL] || ''), archived: isArchived(row[SUPPORT_ARCHIVED_COL]), status: String(row[SUPPORT_STATUS_COL] || '') };
  const put = (col, value) => sheetsFetch(token, rangeUrl(sheetId, title, `${colLetter(col)}${n}`, '?valueInputOption=RAW'), { method: 'PUT', body: JSON.stringify({ values: [[value]] }) });
  if (Array.isArray(tags)) { out.tags = cleanTags(tags).join(','); await put(SUPPORT_TAGS_COL, out.tags); }
  if (typeof archived === 'boolean') {
    out.archived = archived; await put(SUPPORT_ARCHIVED_COL, archived ? 'Yes' : '');
    if (archived && isUnread(out.status)) { out.status = 'Read'; await put(SUPPORT_STATUS_COL, 'Read'); }
  }
  return out;
}

// Every support request ever sent (archived or not), oldest first, for the owner's "View all support requests" page.
// The page searches and filters these in the browser as the owner types, so they are sent in one go. Newest 5000 at most.
export const SUPPORT_ALL_MAX = 5000;
const SUPPORT_ALL_COLS = ['ID', 'Date (PT)', 'Email', 'Status', 'Message', 'App version', 'Device', 'OS version', 'Country', 'Region', 'Recent problems', 'Screenshots', 'Tags', 'Archived'];
export async function supportAll({ token, sheetId }) {
  const found = await findTab(token, sheetId, 'Support');
  if (!found) return { columns: SUPPORT_ALL_COLS, rows: [], total: 0 };
  const body = await sheetsFetch(token, rangeUrl(sheetId, found.title, 'A1:R20000'));
  const all = body.values || [];
  const head = (all[0] || []).map(h => String(h || '').trim());
  const idx = SUPPORT_ALL_COLS.map(c => head.indexOf(c));
  const data = all.slice(1).filter(r => Array.isArray(r) && String(r[0] || '').trim());
  const rows = data.slice(-SUPPORT_ALL_MAX).map(r => idx.map(i => (i >= 0 ? String(r[i] ?? '') : '')));
  return { columns: SUPPORT_ALL_COLS, rows, total: data.length };
}

// Dashboard main list: the header plus the newest `max` requests that aren't archived.
export function activeSupport(rows, max = 200) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const head = rows[0] || [];
  const col = head.findIndex(h => String(h || '').trim() === 'Archived');
  const body = rows.slice(1).filter(r => Array.isArray(r) && String(r[0] || '').trim());
  const open = col < 0 ? body : body.filter(r => !isArchived(r[col]));
  return [head, ...open.slice(-max)];
}

// ── Owner dashboard: only the owner's email(s), set in OWNER_EMAIL, may read the sheets back ──

export const isOwner = (email) => String(process.env.OWNER_EMAIL || '').toLowerCase().split(/[,\s;]+/).filter(Boolean).includes(email);

// ── Testers: accounts the owner has switched the Testing section on for ──
// One row per tester in the "Testers" tab. The owner is always a tester. A person is only ever told about their OWN
// status (the usage report's reply); the full list goes to the owner alone.
const TESTER_COLS = ['Email', 'Added (PT)', 'Added by'];
const TESTER_MAX = 200;
const TESTER_TTL_MS = 60 * 1000;
const EMAIL_RE = /^[^\s@,;<>"'()\[\]\\]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
export const cleanTesterEmail = (v) => { const e = String(v ?? '').trim().toLowerCase(); return e.length <= 254 && EMAIL_RE.test(e) ? e : ''; };
let testerCache = { at: 0, sheetId: '', list: null };
export const clearTesterCache = () => { testerCache = { at: 0, sheetId: '', list: null }; };

// The testers, as [{ email, added }]. A missing tab means nobody yet (and is not created just to answer a question).
export async function listTesters({ token, sheetId, fresh = false }) {
  if (!fresh && testerCache.list && testerCache.sheetId === sheetId && Date.now() - testerCache.at < TESTER_TTL_MS) return testerCache.list;
  const found = await findTab(token, sheetId, 'Testers');
  let list = [];
  if (found) {
    const body = await sheetsFetch(token, rangeUrl(sheetId, found.title, `A2:C${TESTER_MAX + 300}`));
    list = (body.values || []).map(r => ({ email: String(r?.[0] || '').trim().toLowerCase(), added: String(r?.[1] || '') })).filter(t => t.email);
  }
  testerCache = { at: Date.now(), sheetId, list };
  return list;
}
export async function isTester({ token, sheetId, email }) {
  if (isOwner(email)) return true;
  const want = String(email || '').trim().toLowerCase();
  return !!want && (await listTesters({ token, sheetId })).some(t => t.email === want);
}
// Adds or removes one tester. Returns { changed, testers } or { error } (bad email / list full).
export async function setTester({ token, sheetId, email, on, by }) {
  const who = cleanTesterEmail(email);
  if (!who) return { error: 'bad email' };
  const title = await getTab(token, sheetId, 'Testers', TESTER_COLS);
  const body = await sheetsFetch(token, rangeUrl(sheetId, title, `A2:C${TESTER_MAX + 300}`));
  const rows = body.values || [];
  const at = rows.findIndex(r => String(r?.[0] || '').trim().toLowerCase() === who);
  let changed = false;
  if (on && at < 0) {
    if (rows.filter(r => String(r?.[0] || '').trim()).length >= TESTER_MAX) return { error: 'list full' };
    await appendRows(token, sheetId, 'Testers', TESTER_COLS, [[who, ptNow(), String(by || '')]]);
    changed = true;
  } else if (!on && at >= 0) {
    // Blank the row (the list ignores empty rows) instead of shifting rows around.
    await sheetsFetch(token, rangeUrl(sheetId, title, `A${at + 2}:C${at + 2}`, '?valueInputOption=RAW'), { method: 'PUT', body: JSON.stringify({ values: [['', '', '']] }) });
    changed = true;
  }
  clearTesterCache();
  return { changed, testers: await listTesters({ token, sheetId, fresh: true }) };
}

async function readTab(token, sheetId, name, maxRows) {
  const found = name === 'Stats' ? { title: (await getSheetInfo(token, sheetId)).title } : await findTab(token, sheetId, name);
  if (!found) return [];
  const body = await sheetsFetch(token, rangeUrl(sheetId, found.title, 'A1:CZ20000'));
  const rows = body.values || [];
  if (maxRows && rows.length > maxRows + 1) return [rows[0], ...rows.slice(-maxRows)];
  return rows;
}
// The owner dashboard never loads everyone at once. The charts use the most recently active people (STATS_WINDOW),
// the People list is fetched 25 at a time (peoplePage), and one person's full numbers are fetched when tapped (personData).
export const STATS_WINDOW = 300;
export const PEOPLE_PAGE = 25;
const PEOPLE_COLS = ['Email', 'Last login (PT)', 'Sessions', 'Days active', 'Clip library size', 'Device', 'OS version', 'App version', 'Country', 'Region'];

// Stats rows, newest visit first, with the header kept apart.
async function sortedPeople(token, sheetId) {
  const rows = await readTab(token, sheetId, 'Stats');
  const head = rows[0] || [];
  const at = head.findIndex(h => String(h || '').trim() === 'Last login (PT)');
  const body = rows.slice(1).filter(r => Array.isArray(r) && String(r[0] || '').trim());
  body.sort((a, b) => String(b[at] ?? '').localeCompare(String(a[at] ?? '')));
  return { head, body };
}

export async function peoplePage({ token, sheetId, page }) {
  const { head, body } = await sortedPeople(token, sheetId);
  const pages = Math.max(1, Math.ceil(body.length / PEOPLE_PAGE));
  const n = Math.min(Math.max(0, Math.floor(Number(page) || 0)), pages - 1);
  const idx = PEOPLE_COLS.map(c => head.findIndex(h => String(h || '').trim() === c));
  const rows = body.slice(n * PEOPLE_PAGE, (n + 1) * PEOPLE_PAGE).map(r => idx.map(i => (i >= 0 ? r[i] ?? '' : '')));
  return { columns: PEOPLE_COLS, rows, page: n, pages, total: body.length, pageSize: PEOPLE_PAGE };
}

// One person's own numbers for the owner, found by the email the owner tapped. Owner-only (checked by the caller).
export async function personData({ token, sheetId, target }) {
  const email = String(target || '').trim().toLowerCase();
  if (!email || email.length > 254) return null;
  return myData({ token, sheetId, email });
}

export async function dashboardData({ token, sheetId }) {
  const [people, feedback, errors, history, diagnostics, support] = await Promise.all([
    sortedPeople(token, sheetId), readTab(token, sheetId, 'Feedback', 500), readTab(token, sheetId, 'Errors', 500),
    readTab(token, sheetId, 'History', 5000), readTab(token, sheetId, 'Diagnostics', 100), readTab(token, sheetId, 'Support', SUPPORT_ALL_MAX),
  ]);
  const stats = [people.head, ...people.body.slice(0, STATS_WINDOW)];
  const supCol = (support[0] || []).findIndex(h => String(h || '').trim() === 'Archived');
  const supBody = support.slice(1).filter(r => Array.isArray(r) && String(r[0] || '').trim());
  const totals = {
    people: people.body.length, window: Math.min(people.body.length, STATS_WINDOW),
    supportAll: supBody.length, supportArchived: supCol < 0 ? 0 : supBody.filter(r => isArchived(r[supCol])).length,
  };
  // Links to the spreadsheet and its tabs, for the owner's "Needs attention" list.
  const info = await getSheetInfo(token, sheetId);
  const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/edit`;
  const sheetLinks = { Sheet: base };
  for (const name of ['Stats', 'Feedback', 'Errors', 'History', 'Diagnostics', 'Support']) {
    const t = name === 'Stats' ? { sheetId: info.gid } : info.tabs.find(x => String(x.title).trim().toLowerCase() === name.toLowerCase());
    if (t && Number.isInteger(t.sheetId)) sheetLinks[name] = `${base}#gid=${t.sheetId}`;
  }
  return { stats, totals, feedback, errors, history, diagnostics, support: activeSupport(support), sheetLinks, generated: ptNow() };
}

// ── A person's own numbers: only rows whose Email is the verified caller's email, filtered here before anything is sent ──

// Keeps the header row plus the rows belonging to `email`. If the tab has no Email column it sends nothing (fails closed).
export function onlyMine(rows, email, drop = []) {
  if (!Array.isArray(rows) || rows.length === 0 || !email) return [];
  const head = rows[0] || [];
  const col = head.findIndex(h => String(h || '').trim().toLowerCase() === 'email');
  if (col < 0) return [];
  const want = String(email).trim().toLowerCase();
  const keep = head.map((h, i) => (drop.includes(String(h || '').trim()) ? -1 : i)).filter(i => i >= 0);
  const mine = rows.slice(1).filter(r => Array.isArray(r) && String(r[col] || '').trim().toLowerCase() === want);
  return [keep.map(i => head[i]), ...mine.map(r => keep.map(i => r[i] ?? ''))];
}
export async function myData({ token, sheetId, email }) {
  const [stats, feedback, errors, history, diagnostics, support] = await Promise.all([
    readTab(token, sheetId, 'Stats'), readTab(token, sheetId, 'Feedback', 2000), readTab(token, sheetId, 'Errors', 2000),
    readTab(token, sheetId, 'History', 20000), readTab(token, sheetId, 'Diagnostics', 500), readTab(token, sheetId, 'Support', 2000),
  ]);
  return {
    stats: onlyMine(stats, email, ['Last IP']), feedback: onlyMine(feedback, email), errors: onlyMine(errors, email),
    history: onlyMine(history, email), diagnostics: onlyMine(diagnostics, email), support: onlyMine(support, email), generated: ptNow(),
  };
}

// ── The function ────────────────────────────────────────────────────────

const reply = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

const busy = (retryAfter) => new Response(JSON.stringify({ ok: false, busy: true, retryAfter }), {
  status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': String(retryAfter) },
});

export default async (req, context) => {
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'POST only' });

  const sheetId = process.env.SHEET_ID;
  let creds = null;
  try { creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || 'null'); } catch { /* handled below */ }
  if (!sheetId || !creds?.client_email || !creds?.private_key) return reply(500, { ok: false, error: 'logger not configured' });

  let body;
  try {
    const text = await req.text();
    if (text.length > 40000) return reply(413, { ok: false, error: 'too large' });
    body = JSON.parse(text);
  } catch { return reply(400, { ok: false, error: 'bad request' }); }
  if (typeof body?.accessToken !== 'string' || body.accessToken.length < 20 || body.accessToken.length > 4096) {
    return reply(400, { ok: false, error: 'bad request' });
  }

  // A single network address can't flood the function (each running copy of the server counts for itself).
  if (tooFast(context?.ip)) return busy(60);

  // While Google is refusing requests, routine reports are turned away early (the app keeps its counts and tries
  // again later). Feedback, problem reports and the dashboard still go through.
  if (!body.kind && Date.now() < busyUntil) return busy(Math.ceil((busyUntil - Date.now()) / 1000) + 30);

  try {
    const email = await verifyUser(body.accessToken);
    if (!email) return reply(401, { ok: false, error: 'not verified' });

    // Daily allowances per person for the things that write a new row each time.
    if (body.kind === 'support' || body.kind === 'feedback' || body.kind === 'diagnostic') {
      const a = await bumpDaily(`${body.kind}:${who(email)}`, DAILY[body.kind]);
      if (!a.ok) return reply(422, { ok: false, limit: true, error: 'daily limit' });
      const sweep = dailySweep();   // once a day: removes old screenshots and counters
      context?.waitUntil?.(sweep);
    }
    // Routine usage reports: at most one every few seconds per person (the app sends far fewer).
    if (!body.kind) {
      const now = Date.now(), floor = Number(process.env.PING_FLOOR_MS ?? 10000), last = lastPing.get(email) || 0;
      if (now - last < floor) return reply(200, { ok: true, skipped: true });
      lastPing.set(email, now);
      if (lastPing.size > 5000) lastPing.clear();
    }

    const geo = context?.geo || {};
    const where = {
      ip: context?.ip || '',
      country: geo.country?.code || '',
      region: geo.subdivision?.name || geo.subdivision?.code || '',
    };
    const token = await serviceToken(creds);
    if (body.kind === 'dashboard') {
      if (!isOwner(email)) return reply(403, { ok: false, error: 'owner only' });
      return reply(200, { ok: true, ...(await dashboardData({ token, sheetId })) });
    }
    if (body.kind === 'support') {
      const d = cleanSupport(body);
      if (d.message.length < 3) return reply(400, { ok: false, error: 'message needed' });
      await addSupport({ token, sheetId, email, d, where });
      return reply(200, { ok: true });
    }
    if (body.kind === 'supportcount') {   // the owner's "unread requests" check
      if (!isOwner(email)) return reply(403, { ok: false, error: 'owner only' });
      return reply(200, { ok: true, ...(await supportUnread({ token, sheetId })) });
    }
    if (body.kind === 'supportread') {
      if (!isOwner(email)) return reply(403, { ok: false, error: 'owner only' });
      const marked = await markSupportRead({ token, sheetId, ids: body.ids, all: body.all });
      return reply(200, { ok: true, marked, ...(await supportUnread({ token, sheetId })) });
    }
    if (body.kind === 'supportupdate') {   // owner only: tag and/or archive one request
      if (!isOwner(email)) return reply(403, { ok: false, error: 'owner only' });
      const done = await updateSupport({ token, sheetId, id: body.id, tags: body.tags, archived: body.archived });
      if (!done) return reply(404, { ok: false, error: 'no such request' });
      return reply(200, { ok: true, ...done, ...(await supportUnread({ token, sheetId })) });
    }
    if (body.kind === 'supportall') {   // owner only: every request, for the "View all support requests" page
      if (!isOwner(email)) return reply(403, { ok: false, error: 'owner only' });
      return reply(200, { ok: true, ...(await supportAll({ token, sheetId })) });
    }
    if (body.kind === 'people') {
      if (!isOwner(email)) return reply(403, { ok: false, error: 'owner only' });
      return reply(200, { ok: true, ...(await peoplePage({ token, sheetId, page: body.page })) });
    }
    if (body.kind === 'person') {
      if (!isOwner(email)) return reply(403, { ok: false, error: 'owner only' });
      const one = await personData({ token, sheetId, target: body.target });
      if (!one) return reply(400, { ok: false, error: 'bad request' });
      return reply(200, { ok: true, ...one });
    }
    if (body.kind === 'testers') {   // owner only: who the Testing section is switched on for
      if (!isOwner(email)) return reply(403, { ok: false, error: 'owner only' });
      return reply(200, { ok: true, testers: await listTesters({ token, sheetId, fresh: true }) });
    }
    if (body.kind === 'testerset') {   // owner only: switch Testing on or off for one email
      if (!isOwner(email)) return reply(403, { ok: false, error: 'owner only' });
      if (typeof body.on !== 'boolean' || !cleanTesterEmail(body.email)) return reply(400, { ok: false, error: 'bad request' });
      const r = await setTester({ token, sheetId, email: body.email, on: body.on, by: email });
      if (r.error === 'list full') return reply(422, { ok: false, error: 'list full' });
      if (r.error) return reply(400, { ok: false, error: 'bad request' });
      return reply(200, { ok: true, changed: r.changed, testers: r.testers });
    }
    if (body.kind === 'mydata') {   // the email comes only from the verified token, never from the request body
      return reply(200, { ok: true, owner: isOwner(email), ...(await myData({ token, sheetId, email })) });
    }
    if (body.kind === 'diagnostic') {
      await addDiagnostic({ token, sheetId, email, d: cleanDiagnostic(body), where });
      return reply(200, { ok: true });
    }
    if (body.kind === 'feedback') {
      const fb = cleanFeedback(body);
      if (fb.rating === null) return reply(400, { ok: false, error: 'rating needed' });
      await addFeedback({ token, sheetId, email, fb, where });
      return reply(200, { ok: true });
    }
    const result = await upsertUser({ token, sheetId, email, payload: cleanPayload(body), where });
    // Tell the person (only) whether the Testing section is on for them. If the list can't be read just now, say nothing
    // and the app keeps what it already knew.
    let tester;
    try { tester = await isTester({ token, sheetId, email }); } catch { /* leave the flag as it was */ }
    return reply(200, { ok: true, created: result.created, owner: isOwner(email), ...(tester === undefined ? {} : { tester }) });
  } catch (err) {
    if (err.busy) return busy(60);
    console.error('log-usage failed:', err.message);
    return reply(500, { ok: false, error: 'could not record' });
  }
};
