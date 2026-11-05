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

const CLIENT_ID = '495492558072-8ohvj2v3npv2coeq1alndbh0g0lk95s2.apps.googleusercontent.com';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

// Tabs we count (must match the view ids in the app) and their spreadsheet labels.
const TABS = [
  ['record', 'Record'], ['library', 'Library'], ['keyfinder', 'Key Finder'], ['practice', 'Practice'],
  ['randomizer', 'Randomizer'], ['jam', 'Jam'], ['settings', 'Settings'], ['about', 'About'],
  ['changelog', 'Changelog'], ['debug', 'Debug'],
];
const DEVICES = ['iPhone', 'iPad', 'Android phone', 'Android tablet', 'Windows', 'Mac', 'Linux', 'ChromeOS', 'Other'];

// Column layout. One place to change if columns are added later: new columns go on the END.
const COLS = [
  'Email', 'First login (PT)', 'Last login (PT)', 'Last IP', 'Country', 'Region',
  'Clip library size', 'Avg recording length (sec)', 'Most used tab', 'Custom drum beats', 'Song ideas saved',
  'Sessions', 'App version', 'Device', 'Installed app',
  ...TABS.map(([, label]) => `Views: ${label}`),
  'Recordings counted', 'Recording seconds counted',
  'OS version', 'Device model', 'Screen', 'Browser',
  'Offline clips waiting', 'Upload failures', 'Settings save failures', 'App errors', 'Last error type',
  'Active minutes', 'Days active',
  'Jam plays', 'Practice picks', 'Key Finder lookups', 'Wheel spins', 'Surprise me uses', 'Ideas saved (saves)', 'Multi-key ideas saved',
  'Theme', 'Note names', 'Custom note colors', 'Strum speed', 'Time zone', 'Language',
  'Clips with key', 'Clips with tempo', 'Clips with tags',
];
// Counted events the app may send, and the column each one adds to.
const EVENT_COLS = {
  uploadFail: 'Upload failures', settingsFail: 'Settings save failures', errors: 'App errors',
  jamPlay: 'Jam plays', practicePick: 'Practice picks', keyLookup: 'Key Finder lookups', spin: 'Wheel spins',
  surprise: 'Surprise me uses', idea: 'Ideas saved (saves)', ideaMultiKey: 'Multi-key ideas saved',
};
const THEMES = ['light', 'dark', 'match device'];
const IDX = Object.fromEntries(COLS.map((name, i) => [name, i]));
const TAB_COL = (id) => IDX[`Views: ${TABS.find(([k]) => k === id)[1]}`];

export const _internals = { COLS, TABS };

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

async function verifyUser(accessToken) {
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
const TZ_RE = /^[A-Za-z_\/+\-0-9]{1,40}$/, LANG_RE = /^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8}){0,2}$/, ERR_RE = /^[A-Za-z]{3,30}$/;
const OS_RE = /^[\w .\-+()]{1,30}$/, MODEL_RE = /^[\w .\-+()\/,]{1,80}$/, SCREEN_RE = /^\d{2,5}x\d{2,5}@\d{1,2}(\.\d{1,2})?$/, BROWSER_RE = /^[\w .\-+()]{1,30}$/;

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
    customColors: typeof body?.choices?.customColors === 'boolean' ? body.choices.customColors : null,
    timeZone: shortText(body?.choices?.timeZone, TZ_RE),
    language: shortText(body?.choices?.language, LANG_RE),
    lastError: shortText(body?.lastError, ERR_RE),
    events: Object.fromEntries(Object.keys(EVENT_COLS).map(k => [k, count(delta.events?.[k], 100000) || 0]).filter(([, n]) => n)),
    activeSec: count(delta.activeSec, 1e6) || 0,
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

async function sheetsFetch(token, url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Sheets ${res.status}: ${body.error?.message || 'error'}`);
  return body;
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

let feedbackTitle = null;
async function getFeedbackTitle(token, sheetId) {
  if (feedbackTitle) return feedbackTitle;
  const info = await getSheetInfo(token, sheetId);
  const found = info.tabs.find(t => String(t.title).trim().toLowerCase() === 'feedback');
  if (found) { feedbackTitle = found.title; return feedbackTitle; }
  await sheetsFetch(token, `${SHEETS}/${encodeURIComponent(sheetId)}:batchUpdate`, {
    method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Feedback' } } }] }),
  });
  feedbackTitle = 'Feedback';
  return feedbackTitle;
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

export async function upsertUser({ token, sheetId, email, payload, where }) {
  const { title, gid } = await getSheetInfo(token, sheetId);
  let emails = await emailRows(token, sheetId, title);
  await ensureHeader(token, sheetId, title, emails[0]);
  if (emails[0] !== 'email') emails = ['email', ...emails.slice(1)];
  let rowNum = emails.indexOf(email, 1) + 1; // 1-based sheet row; 0 when not found

  if (rowNum > 0) {
    const cur = await sheetsFetch(token, rangeUrl(sheetId, title, `A${rowNum}:${LAST_COL}${rowNum}`));
    const row = buildRow(cur.values?.[0] || null, email, payload, where);
    await sheetsFetch(token, rangeUrl(sheetId, title, `A${rowNum}:${LAST_COL}${rowNum}`, '?valueInputOption=RAW'), {
      method: 'PUT', body: JSON.stringify({ values: [row] }),
    });
    return { row: rowNum, created: false };
  }

  const row = buildRow(null, email, payload, where);
  const out = await sheetsFetch(token, rangeUrl(sheetId, title, 'A1', ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS'), {
    method: 'POST', body: JSON.stringify({ values: [row] }),
  });
  const m = /!A(\d+)/.exec(out.updates?.updatedRange || '');
  rowNum = m ? Number(m[1]) : 0;

  // Two first-time reports from the same person at the same instant (e.g. two
  // devices) could each add a row. Check once and remove any extras so the
  // email stays on exactly one line.
  await removeDuplicates(token, sheetId, title, gid, email);
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

const FEEDBACK_COLS = ['Date (PT)', 'Email', 'Rating', 'Feedback', 'Country', 'Region', 'App version'];
let feedbackHeaderDone = false;

export function cleanFeedback(body) {
  const r = Number(body?.rating);
  const rating = Number.isFinite(r) && r >= 0.5 && r <= 5 && Math.round(r * 2) === r * 2 ? r : null;
  const text = typeof body?.text === 'string' ? body.text.replace(/\r\n?/g, '\n').trim().slice(0, 2000) : '';
  const version = typeof body?.version === 'string' && /^[\w.\- ]{1,24}$/.test(body.version) ? body.version : '';
  return { rating, text, version };
}

export async function addFeedback({ token, sheetId, email, fb, where }) {
  const title = await getFeedbackTitle(token, sheetId);
  if (!feedbackHeaderDone) {
    const first = await sheetsFetch(token, rangeUrl(sheetId, title, 'A1:G1'));
    if (String(first.values?.[0]?.[0] || '') !== FEEDBACK_COLS[0]) {
      await sheetsFetch(token, rangeUrl(sheetId, title, 'A1:G1', '?valueInputOption=RAW'), {
        method: 'PUT', body: JSON.stringify({ values: [FEEDBACK_COLS] }),
      });
    }
    feedbackHeaderDone = true;
  }
  const row = [ptNow(), email, fb.rating, fb.text, where.country, where.region, fb.version];
  await sheetsFetch(token, rangeUrl(sheetId, title, 'A1', ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS'), {
    method: 'POST', body: JSON.stringify({ values: [row] }),
  });
}

// ── The function ────────────────────────────────────────────────────────

const reply = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
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
    if (text.length > 20000) return reply(413, { ok: false, error: 'too large' });
    body = JSON.parse(text);
  } catch { return reply(400, { ok: false, error: 'bad request' }); }
  if (typeof body?.accessToken !== 'string' || body.accessToken.length < 20 || body.accessToken.length > 4096) {
    return reply(400, { ok: false, error: 'bad request' });
  }

  try {
    const email = await verifyUser(body.accessToken);
    if (!email) return reply(401, { ok: false, error: 'not verified' });

    const geo = context?.geo || {};
    const where = {
      ip: context?.ip || '',
      country: geo.country?.code || '',
      region: geo.subdivision?.name || geo.subdivision?.code || '',
    };
    const token = await serviceToken(creds);
    if (body.kind === 'feedback') {
      const fb = cleanFeedback(body);
      if (fb.rating === null) return reply(400, { ok: false, error: 'rating needed' });
      await addFeedback({ token, sheetId, email, fb, where });
      return reply(200, { ok: true });
    }
    const result = await upsertUser({ token, sheetId, email, payload: cleanPayload(body), where });
    return reply(200, { ok: true, created: result.created });
  } catch (err) {
    console.error('log-usage failed:', err.message);
    return reply(500, { ok: false, error: 'could not record' });
  }
};
