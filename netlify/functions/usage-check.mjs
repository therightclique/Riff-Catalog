// Riff Catalog - setup check for usage logging.
//
// Opening this function's address in a browser runs a short self-test and
// prints the result: are the Netlify settings present, can we sign in as the
// service account, can we reach the "Riff Catalog Usage" spreadsheet, and does
// Netlify tell us the visitor's country. It never writes anything and never
// prints any secret. It is temporary and will be removed once real logging works.

import { createSign } from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const b64url = (value) => Buffer.from(value).toString('base64url');

async function getAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: creds.client_email,
    scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signature = createSign('RSA-SHA256').update(`${header}.${claim}`).sign(creds.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${signature}`,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`Google refused the sign-in (${res.status}): ${body.error_description || body.error || 'unknown reason'}`);
  }
  return body.access_token;
}

export default async (req, context) => {
  const steps = [];
  const add = (step, ok, detail) => steps.push({ step, ok, detail });

  // 1. Settings present
  const sheetId = process.env.SHEET_ID;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  add('SHEET_ID setting found', !!sheetId, sheetId ? 'yes' : 'missing - add it under Environment variables');
  add('GOOGLE_SERVICE_ACCOUNT_JSON setting found', !!rawKey, rawKey ? `yes (${rawKey.length} characters)` : 'missing - add it under Environment variables');

  // 2. Key file readable
  let creds = null;
  if (rawKey) {
    try {
      creds = JSON.parse(rawKey);
      const ok = !!(creds.client_email && creds.private_key);
      add('Key file is complete', ok, ok ? `service account: ${creds.client_email}` : 'the pasted text is missing client_email or private_key');
      if (!ok) creds = null;
    } catch {
      add('Key file is complete', false, 'the pasted text is not valid JSON - it was probably cut off or edited when pasted');
    }
  }

  // 3. Sign in as the service account, 4. read the spreadsheet
  if (creds && sheetId) {
    try {
      const token = await getAccessToken(creds);
      add('Signed in to Google as the service account', true, 'yes');
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=properties.title,sheets.properties.title`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        const tabs = (body.sheets || []).map(s => s.properties.title).join(', ');
        add('Reached the spreadsheet', true, `"${body.properties.title}" (tabs: ${tabs})`);
      } else {
        const msg = body.error?.message || 'unknown reason';
        const hint = res.status === 403 || res.status === 404
          ? ' - check the sheet is shared with the service account as Editor, and that the Sheets API is enabled'
          : '';
        add('Reached the spreadsheet', false, `Google said ${res.status}: ${msg}${hint}`);
      }
    } catch (err) {
      add('Signed in to Google as the service account', false, err.message);
    }
  }

  // 5. Visitor location from Netlify (shows whether country/region will be available)
  const country = context?.geo?.country?.code || null;
  const region = context?.geo?.subdivision?.code || context?.geo?.subdivision?.name || null;
  add('Netlify can see the visitor country', !!country, country ? `${country}${region ? ' / ' + region : ''}` : 'not available');
  add('Netlify can see the visitor IP address', !!context?.ip, context?.ip ? 'yes (not shown here)' : 'not available');

  const allOk = steps.every(s => s.ok);
  return new Response(JSON.stringify({ allOk, steps }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
};
