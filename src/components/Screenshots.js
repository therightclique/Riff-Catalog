// Screenshots for Support messages.
//
// Each picture is shrunk on this device to a small JPEG first (so a big phone screenshot doesn't use up data or
// the server's allowance), then uploaded on its own. The server hands back a short key that goes in the message.
// Only the app's owner can open the pictures.

const ENDPOINT = '/api/support-image';
export const MAX_SHOTS = 3;
const TARGET_BYTES = 300 * 1024;      // the server accepts up to 350 KB
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

const loadViaImg = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
  img.src = url;
});
const toBlob = (canvas, q) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', q));

// Returns a JPEG Blob of at most about 300 KB. Throws an Error whose message is 'not-image', 'too-big' or 'unreadable'.
export async function shrinkImage(file) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('not-image');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('too-big');
  let src;
  try { src = await createImageBitmap(file); } catch { src = await loadViaImg(file); }
  const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
  if (!w || !h) throw new Error('unreadable');
  let side = 1280;
  for (let round = 0; round < 5; round++) {
    const scale = Math.min(1, side / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale)); canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);   // transparent PNGs become white, not black
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    for (const q of [0.8, 0.7, 0.6, 0.5, 0.4]) {
      const blob = await toBlob(canvas, q);
      if (blob && blob.size <= TARGET_BYTES) { try { src.close?.(); } catch { /* not an ImageBitmap */ } return blob; }
    }
    side = Math.round(side * 0.75);
  }
  throw new Error('unreadable');
}

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
  fr.onerror = () => reject(new Error('unreadable'));
  fr.readAsDataURL(blob);
});

// { ok: true, key } or { ok: false, reason: 'limit' | 'unavailable' | 'signin' | 'offline' | 'failed' }
export async function uploadScreenshot(blob, accessToken) {
  try {
    const data = await toBase64(blob);
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken, action: 'put', data }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.key) return { ok: true, key: j.key };
    if (j.limit) return { ok: false, reason: 'limit' };
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'signin' };
    if (res.status === 503 || res.status === 404 || res.status === 413) return { ok: false, reason: 'unavailable' };
    return { ok: false, reason: 'failed' };
  } catch { return { ok: false, reason: 'offline' }; }
}

// Owner only. Returns a temporary address that can be used as an <img> source, or null (expired, removed or not allowed).
export async function fetchScreenshot(key, accessToken) {
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken, action: 'get', key }) });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch { return null; }
}

export const REASON_TEXT = {
  limit: 'You’ve reached today’s limit for screenshots. Remove them to send your message without, or try again tomorrow.',
  unavailable: 'Screenshots can’t be attached right now. Remove them to send your message without.',
  signin: 'Your Google connection has expired. Reconnect Drive and try again.',
  offline: 'Couldn’t upload the screenshots. Check your connection and try again, or remove them to send your message without.',
  failed: 'Couldn’t upload a screenshot. Try again, or remove it to send your message without.',
};
