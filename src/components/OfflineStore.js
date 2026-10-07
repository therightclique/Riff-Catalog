// On-device storage for recordings that haven't been confirmed on Google
// Drive yet. Every save is written here FIRST, then uploaded, verified on
// Drive, and only then deleted — so a recording can't be lost to being
// offline, an expired sign-in, a Drive error, or the app closing mid-upload.
//
// IndexedDB, because recordings are far too large for localStorage. Audio
// is stored as an ArrayBuffer rather than a Blob: Blob-in-IndexedDB has had
// long-standing reliability bugs in Safari/WebKit, while ArrayBuffers are
// plain data that every engine stores the same way.
//
// Record shape:
//   { id, name, mimeType, audio: ArrayBuffer, size, metadata, createdTime,
//     driveAudioId? }   // set if the audio reached Drive but its metadata
//                       // file didn't — sync then only uploads metadata

const DB_NAME = 'riffcatalog';
const DB_VERSION = 1;
const STORE = 'pendingClips';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // A failed open shouldn't poison every later attempt.
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function run(mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;
    const req = fn(store);
    if (req) req.onsuccess = () => { result = req.result; };
    // Resolve on transaction COMPLETE, not request success — that's the
    // point at which the write is actually durable.
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  }));
}

// Asks the browser not to evict our storage under space pressure. Best
// effort — not every browser honours it, and nothing depends on it.
let persistRequested = false;
function requestPersistence() {
  if (persistRequested) return;
  persistRequested = true;
  try {
    navigator.storage?.persist?.().then(granted => {
      console.log(`[offline] persistent storage ${granted ? 'granted' : 'not granted'}`);
    });
  } catch { /* ignore */ }
}

export async function savePending({ name, mimeType, blob, metadata }) {
  requestPersistence();
  const audio = await blob.arrayBuffer();
  const record = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    mimeType,
    audio,
    size: audio.byteLength,
    metadata,
    createdTime: new Date().toISOString(),
  };
  await run('readwrite', store => store.put(record));
  console.log(`[offline] saved "${name}" on device (${Math.round(record.size / 1024)} KB)`);
  return record;
}

// Records WITHOUT the audio bytes — what the UI needs to draw cards and the
// banner. (getAll still reads everything, but the multi-MB buffers are
// dropped immediately instead of being held in React state.)
export async function listPendingSummaries() {
  const all = await listPending();
  return all.map(({ audio, ...rest }) => rest);
}

// Ids currently being uploaded by a live save (App's doUpload). The sync
// service skips these so a recording that's mid-upload can't be picked up
// and uploaded a second time. Memory-only on purpose: after an app
// restart nothing is in flight, and any half-finished upload is reconciled
// by its Drive-side localId tag instead (see SyncService).
const inFlight = new Set();
export const markInFlight = (id) => { inFlight.add(id); };
export const clearInFlight = (id) => { inFlight.delete(id); };
export const isInFlight = (id) => inFlight.has(id);

export function getPending(id) {
  return run('readonly', store => store.get(id));
}

export async function listPending() {
  const all = await run('readonly', store => store.getAll());
  return (all || []).sort((a, b) => a.createdTime.localeCompare(b.createdTime));
}

export async function updatePending(id, changes) {
  const existing = await getPending(id);
  if (!existing) return null;
  const updated = { ...existing, ...changes };
  await run('readwrite', store => store.put(updated));
  return updated;
}

export async function deletePending(id) {
  await run('readwrite', store => store.delete(id));
  console.log(`[offline] removed local copy ${id} (confirmed on Drive)`);
}

export function pendingToBlob(record) {
  return new Blob([record.audio], { type: record.mimeType });
}
