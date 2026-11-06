// Riff Catalog - support screenshots.
//
// A person writing to Support can attach a few screenshots. The app shrinks each one to a small JPEG first;
// this function checks it, stores it in Netlify Blobs, and hands back a key that goes into the Support row.
// Only the owner can look at the pictures. Everything is capped: size per picture, pictures per message,
// pictures per person per day, pictures per day overall, and total space. Pictures are deleted after 60 days.
//
//   { accessToken, action: 'put', data: <base64 JPEG> }  -> { ok, key }
//   { accessToken, action: 'get', key }                   -> the JPEG (owner only)

import { randomBytes } from 'node:crypto';
import { verifyUser, isOwner } from './log-usage.mjs';
import {
  IMAGE_MAX_BYTES, IMAGES_PER_PERSON_PER_DAY, IMAGES_ALL_PEOPLE_PER_DAY, IMAGES_STORE_MAX_BYTES, IMG_KEY_RE,
  addStoredBytes, bumpDaily, dailySweep, openStore, ptDay, storedBytes, tooFast, who,
} from './lib/limits.mjs';

// Checked by Netlify before the function runs, so a flood costs almost nothing.
export const config = {
  path: '/api/support-image',
  rateLimit: { windowLimit: 40, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

const json = (status, obj) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

const isJpeg = (b) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only' });
  if (tooFast(context?.ip, Number(process.env.IMAGE_IP_LIMIT_PER_MIN ?? 40))) return json(429, { ok: false, error: 'slow down' });

  let body;
  try {
    const text = await req.text();
    if (text.length > Math.ceil(IMAGE_MAX_BYTES * 1.4) + 2000) return json(413, { ok: false, error: 'too large' });
    body = JSON.parse(text);
  } catch { return json(400, { ok: false, error: 'bad request' }); }
  if (typeof body?.accessToken !== 'string' || body.accessToken.length < 20 || body.accessToken.length > 4096) return json(400, { ok: false, error: 'bad request' });

  try {
    const email = await verifyUser(body.accessToken);
    if (!email) return json(401, { ok: false, error: 'not verified' });
    const store = await openStore('support-images');
    if (!store) return json(503, { ok: false, error: 'storage unavailable' });

    if (body.action === 'get') {
      if (!isOwner(email)) return json(403, { ok: false, error: 'owner only' });
      if (typeof body.key !== 'string' || !IMG_KEY_RE.test(body.key)) return json(400, { ok: false, error: 'bad request' });
      const bytes = await store.get(body.key, { type: 'arrayBuffer' });
      if (!bytes) return json(404, { ok: false, error: 'gone' });
      return new Response(bytes, { status: 200, headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
    }

    if (body.action !== 'put') return json(400, { ok: false, error: 'bad request' });
    if (typeof body.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(body.data)) return json(400, { ok: false, error: 'bad picture' });
    const bytes = Buffer.from(body.data, 'base64');
    if (bytes.length > IMAGE_MAX_BYTES) return json(413, { ok: false, error: 'picture too big' });
    if (!isJpeg(bytes)) return json(400, { ok: false, error: 'bad picture' });

    if ((await storedBytes()) + bytes.length > IMAGES_STORE_MAX_BYTES) return json(503, { ok: false, error: 'storage full' });
    const mine = await bumpDaily(`img:${who(email)}`, IMAGES_PER_PERSON_PER_DAY);
    if (!mine.ok) return json(422, { ok: false, limit: true, error: 'daily limit' });
    const all = await bumpDaily('img:all', IMAGES_ALL_PEOPLE_PER_DAY);
    if (!all.ok) return json(422, { ok: false, limit: true, error: 'busy today' });

    const key = `${ptDay().replace(/-/g, '')}/${randomBytes(8).toString('hex')}.jpg`;
    await store.set(key, bytes, { metadata: { bytes: bytes.length, who: who(email) } });
    await addStoredBytes(bytes.length);
    const sweep = dailySweep();
    context?.waitUntil?.(sweep);
    return json(200, { ok: true, key });
  } catch (err) {
    console.error('support-image failed:', err.message);
    return json(500, { ok: false, error: 'could not store' });
  }
};
