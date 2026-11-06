// Riff Catalog - shared limits that keep the server from being used up by accident or on purpose.
//
//  * Screenshot rules (size, how many, how long they are kept).
//  * Daily allowances per person, remembered in Netlify Blobs so they hold across every server instance.
//  * A short in-memory speed limit per network address.
// If Netlify Blobs can't be reached, the daily allowances step aside ("fail open") so the app keeps working;
// the size limits and the per-address speed limit still apply.
//
// This file lives in a sub-folder on purpose: Netlify treats only the top-level files as functions.

import { createHash } from 'node:crypto';

// ── Screenshot rules ──
export const IMAGE_MAX_BYTES = 350 * 1024;          // one picture, after the app has shrunk it (the app aims for about 250 KB)
export const IMAGES_PER_MESSAGE = 3;
export const IMAGES_PER_PERSON_PER_DAY = 6;
export const IMAGES_ALL_PEOPLE_PER_DAY = 100;
export const IMAGES_STORE_MAX_BYTES = 150 * 1024 * 1024;   // everything kept, in total
export const IMAGE_KEEP_DAYS = 60;
export const IMG_KEY_RE = /^\d{8}\/[0-9a-f]{16}\.jpg$/;

// ── Daily allowances per person (Pacific time days) ──
export const DAILY = { support: 10, feedback: 10, diagnostic: 10 };

let override = null;
export const _setBlobs = (fn) => { override = fn; };
export async function openStore(name) {
  try {
    if (override) return override(name);
    const m = await import('@netlify/blobs');
    return m.getStore(name);
  } catch { return null; }
}

export const ptDay = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Los_Angeles', dateStyle: 'short' }).format(d);
export const who = (email) => createHash('sha256').update(String(email || '')).digest('hex').slice(0, 16);

// Adds `cost` to today's count for `name` unless that would pass `limit`. Returns { ok, count }.
export async function bumpDaily(name, limit, cost = 1) {
  const store = await openStore('rc-limits');
  if (!store) return { ok: true, count: 0, open: true };
  try {
    const key = `${ptDay()}/${name}`;
    const cur = Number(await store.get(key)) || 0;
    if (cur + cost > limit) return { ok: false, count: cur };
    await store.set(key, String(cur + cost));
    return { ok: true, count: cur + cost };
  } catch { return { ok: true, count: 0, open: true }; }
}

export async function storedBytes() {
  const store = await openStore('rc-limits');
  if (!store) return 0;
  try { return Number(await store.get('total-bytes')) || 0; } catch { return 0; }
}
export async function addStoredBytes(delta) {
  const store = await openStore('rc-limits');
  if (!store) return;
  try { await store.set('total-bytes', String(Math.max(0, (Number(await store.get('total-bytes')) || 0) + delta))); } catch { /* best effort */ }
}

// Once a day: delete screenshots older than IMAGE_KEEP_DAYS and counters older than a few days.
export async function dailySweep() {
  const limits = await openStore('rc-limits');
  if (!limits) return;
  try {
    const today = ptDay();
    if ((await limits.get('sweep-day')) === today) return;
    await limits.set('sweep-day', today);
    const images = await openStore('support-images');
    if (images) {
      const cutoff = ptDay(new Date(Date.now() - IMAGE_KEEP_DAYS * 86400000)).replace(/-/g, '');
      const { blobs } = await images.list();
      let freed = 0;
      for (const b of blobs || []) {
        if (String(b.key).slice(0, 8) >= cutoff) continue;
        try { const md = await images.getMetadata(b.key); freed += Number(md?.metadata?.bytes) || 0; } catch { /* size unknown */ }
        await images.delete(b.key);
      }
      if (freed) await addStoredBytes(-freed);
    }
    const old = ptDay(new Date(Date.now() - 3 * 86400000));
    const { blobs: counters } = await limits.list();
    for (const b of counters || []) {
      if (/^\d{4}-\d{2}-\d{2}\//.test(b.key) && b.key.slice(0, 10) < old) await limits.delete(b.key);
    }
  } catch { /* try again tomorrow */ }
}

// ── Speed limit per network address (each running copy of the server counts for itself) ──
const hits = new Map();
export function tooFast(id, limit = Number(process.env.IP_LIMIT_PER_MIN ?? 150), windowMs = 60000) {
  if (!id) return false;
  const now = Date.now();
  if (hits.size > 5000) { for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k); }
  const h = hits.get(id);
  if (!h || now - h.start > windowMs) { hits.set(id, { start: now, n: 1 }); return false; }
  h.n++;
  return h.n > limit;
}
export const resetSpeed = () => hits.clear();
