/* Service worker template. The three placeholder constants below are
 * replaced at build time; BUILD_ID guarantees the file changes byte-wise on
 * every deploy so browsers reliably detect updates. */
const BUILD_ID = '__BUILD_ID__';
const BASE = '__BASE__';
const PRECACHE = __PRECACHE__;

const PRECACHE_NAME = `precache-${BUILD_ID}`;
const RUNTIME_NAME = 'runtime-v1';
const NAV_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME).then((cache) => cache.addAll(PRECACHE.map((p) => BASE + p))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith('precache-') && n !== PRECACHE_NAME)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function networkFirst(request, cacheName, fallbackUrl) {
  return (async () => {
    const cache = await caches.open(cacheName);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NAV_TIMEOUT_MS);
    try {
      const response = await fetch(request, { signal: controller.signal });
      clearTimeout(timer);
      if (response.ok) {
        cache.put(fallbackUrl ?? request, response.clone());
      }
      return response;
    } catch {
      clearTimeout(timer);
      const cached = await cache.match(fallbackUrl ?? request);
      if (cached) return cached;
      throw new Error('offline and not cached');
    }
  })();
}

function cacheFirst(request, cacheName) {
  return (async () => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  })();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Reload must never serve a stale shell while the network is up.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PRECACHE_NAME, BASE + 'index.html'));
    return;
  }
  if (url.pathname === BASE + 'data/manifest.json') {
    event.respondWith(networkFirst(request, RUNTIME_NAME));
    return;
  }
  // Content-hashed batches are immutable: cache-first is safe.
  if (url.pathname.startsWith(BASE + 'data/batch-')) {
    event.respondWith(cacheFirst(request, RUNTIME_NAME));
    return;
  }
  // Hashed build assets and precached statics are immutable per BUILD_ID.
  if (PRECACHE.includes(url.pathname.slice(BASE.length))) {
    event.respondWith(cacheFirst(request, PRECACHE_NAME));
    return;
  }
});
