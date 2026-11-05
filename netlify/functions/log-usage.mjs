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
];
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
    tabs,
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

async function getSheetInfo(token, sheetId) {
  if (sheetInfo && sheetInfo.sheetId === sheetId) return sheetInfo;
  const meta = await sheetsFetch(token, `${SHEETS}/${encodeURIComponent(sheetId)}?fields=sheets.properties(title,sheetId)`);
  const first = meta.sheets?.[0]?.properties;
  if (!first) throw new Error('spreadsheet has no tabs');
  sheetInfo = { sheetId, title: first.title, gid: first.sheetId };
  return sheetInfo;
}

const rangeUrl = (sheetId, title, a1, suffix = '') => `${SHEETS}/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(`'${title}'!${a1}`)}${suffix}`;
const colLetter = (n) => { let s = ''; for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const LAST_COL = colLetter(COLS.length - 1);

async function emailRows(token, sheetId, title) {
  const body = await sheetsFetch(token, rangeUrl(sheetId, title, 'A:A'));
  return (body.values || []).map(r => String(r[0] || '').trim().toLowerCase());
}

async function ensureHeader(token, sheetId, title, firstCell) {
  if (firstCell === 'email') return;
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
    if (text.length > 10000) return reply(413, { ok: false, error: 'too large' });
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
    const result = await upsertUser({ token, sheetId, email, payload: cleanPayload(body), where });
    return reply(200, { ok: true, created: result.created });
  } catch (err) {
    console.error('log-usage failed:', err.message);
    return reply(500, { ok: false, error: 'could not record' });
  }
};
