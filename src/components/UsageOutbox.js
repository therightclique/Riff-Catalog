// Keeps what the person wrote (feedback, problem reports) on this device until the server has it.
//
// If sending fails for a temporary reason (no connection, the server is busy, Google is slow), the message is
// saved here and sent automatically the next time the app can reach the server. Nothing is dropped unless the
// server says the message itself is bad. The Google sign-in token is never saved: a fresh one is used when
// the message is finally sent. Usage counts have their own version of this in UsageLog.js.

const ENDPOINT = '/.netlify/functions/log-usage';
const KEY = 'rc_outbox_v1';
const BACKOFF_KEY = 'rc_report_backoff';
const MAX_ITEMS = 10;
const MAX_AGE_MS = 14 * 24 * 3600 * 1000;

const readJSON = (k, fallback) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? fallback; } catch { return fallback; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked: nothing more to do */ } };

// ---- "busy" back-off, shared by the usage report and the outbox ----

export function backoffRemainingMs() {
  const b = readJSON(BACKOFF_KEY, null);
  return b && Number.isFinite(b.until) ? Math.max(0, b.until - Date.now()) : 0;
}
// After a failed send: wait 2, 4, 8 ... up to 60 minutes, with a random spread so that many people hitting a busy
// server don't all come back at the same moment. A server "retry after" hint can lengthen the wait. Returns the wait in ms.
export function noteSendFailure(retryAfterSec = 0) {
  const b = readJSON(BACKOFF_KEY, { n: 0 });
  const n = Math.min(6, (b.n || 0) + 1);
  const base = Math.min(60 * 60000, 2 * 60000 * 2 ** (n - 1));
  const wait = Math.round(Math.max(base * (0.75 + Math.random() * 0.5), Math.min(3600, Number(retryAfterSec) || 0) * 1000));
  writeJSON(BACKOFF_KEY, { n, until: Date.now() + wait });
  return wait;
}
export function noteSendSuccess() { try { localStorage.removeItem(BACKOFF_KEY); } catch { /* ignore */ } }

// Worth trying again later? Network trouble, "busy" (429/503) and server errors are. A rejected message (400/413) is not.
// 401/403 mean the sign-in needs refreshing, so the message waits for a fresh one.
const retryable = (status) => status === 0 || status === 401 || status === 403 || status === 408 || status === 429 || status >= 500;

let lastProblem = '';
// Why the most recent send was refused: 'limit' means the person has sent the most allowed in a day. Otherwise ''.
export const lastSendProblem = () => lastProblem;

async function post(kind, payload, accessToken) {
  lastProblem = '';
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, kind, accessToken }) });
    let retryAfter = 0;
    try { retryAfter = Number(res.headers.get('retry-after')) || 0; } catch { /* no header */ }
    if (!res.ok) { try { const j = await res.clone().json(); if (j?.limit) lastProblem = 'limit'; } catch { /* no details */ } }
    return { ok: res.ok, status: res.status, retryAfter };
  } catch { return { ok: false, status: 0, retryAfter: 0 }; }
}

// 'sent'    the server has it
// 'queued'  saved on this device, will be sent automatically
// 'failed'  not sent and not saved (sign-in expired, or the message was rejected): the person should try again
export async function sendOrQueue(kind, payload, accessToken) {
  const r = await post(kind, payload, accessToken);
  if (r.ok) { noteSendSuccess(); flushOutbox(accessToken); return 'sent'; }
  if (r.status === 401 || r.status === 403 || !retryable(r.status)) return 'failed';
  const items = readJSON(KEY, []).filter(x => x && Date.now() - x.t < MAX_AGE_MS);
  items.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, t: Date.now(), kind, payload });
  writeJSON(KEY, items.slice(-MAX_ITEMS));
  noteSendFailure(r.retryAfter);
  return 'queued';
}

export function outboxCount() { return readJSON(KEY, []).length; }

let flushing = false;
// Sends whatever is waiting, oldest first, stopping at the first temporary failure. Never throws.
export async function flushOutbox(accessToken) {
  if (flushing || !accessToken || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 0;
  if (!outboxCount() || backoffRemainingMs() > 0) return 0;
  flushing = true;
  let sentCount = 0;
  try {
    let items = readJSON(KEY, []).filter(x => x && Date.now() - x.t < MAX_AGE_MS);
    for (const item of [...items]) {
      const r = await post(item.kind, item.payload, accessToken);
      if (r.ok || (!retryable(r.status))) {
        items = items.filter(x => x.id !== item.id);
        if (r.ok) sentCount++;
        writeJSON(KEY, items);
      } else {
        if (r.status !== 401 && r.status !== 403) noteSendFailure(r.retryAfter);
        break;
      }
    }
    if (!items.length) { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
    if (sentCount) noteSendSuccess();
  } catch { /* try again next time */ } finally { flushing = false; }
  return sentCount;
}
