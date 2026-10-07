// Riff Catalog service worker — lets the installed app launch with no
// internet connection (needed for offline recording).
//
// Strategy, chosen to avoid the classic "stuck on an old version" problem:
//   • Page (navigations): NETWORK-FIRST. Online, you always get the latest
//     deploy; the cached copy is used only if the network fails or takes
//     longer than NAV_TIMEOUT_MS (covers Wi-Fi with no actual internet).
//   • /assets/* (Vite's hashed build files): CACHE-FIRST. Each build gets
//     new filenames, so a cached file can never be the wrong version of
//     itself. Capped at MAX_ASSET_ENTRIES so old builds don't pile up.
//   • Other same-origin files (icons, manifest): stale-while-revalidate.
//   • Anything cross-origin (Google sign-in, Drive API) is never touched.

const SHELL_CACHE = 'riffcatalog-shell-v1';
const ASSET_CACHE = 'riffcatalog-assets-v1';
const NAV_TIMEOUT_MS = 4000;
const MAX_ASSET_ENTRIES = 60;

const SHELL_FILES = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Added individually so one missing file can't fail the whole install.
      Promise.all(SHELL_FILES.map((url) => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith('riffcatalog-') && k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function trimAssetCache() {
  const cache = await caches.open(ASSET_CACHE);
  const keys = await cache.keys();
  // keys() is in insertion order, so the oldest entries come first.
  const excess = keys.length - MAX_ASSET_ENTRIES;
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}

async function handleNavigation(request) {
  try {
    const response = await Promise.race([fetch(request), timeout(NAV_TIMEOUT_MS)]);
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const cached = (await cache.match('/index.html')) || (await cache.match('/'));
    if (cached) return cached;
    return new Response('Riff Catalog is offline and has not been cached yet. Open it once while online.', {
      status: 503, headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function handleAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone()).then(trimAssetCache);
  }
  return response;
}

async function handleOther(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Google / Drive: hands off

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(handleAsset(request));
  } else {
    event.respondWith(handleOther(request));
  }
});
