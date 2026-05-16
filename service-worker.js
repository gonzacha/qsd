/**
 * QSD service worker — minimal PWA shell.
 *
 * Cache strategy (rollback: bump CACHE version and redeploy; old caches deleted on activate):
 * - PRECACHE: offline shell + icons only (fixed URLs).
 * - /api/*: network-only (never cache editorial/API JSON).
 * - navigate + *.html: network-first (avoid stale index after deploy).
 * - static assets (css/js/png/…): cache-first with background update on miss.
 *
 * Dynamic/editorial content must never be served from long-lived SW caches.
 */
const CACHE = 'qsd-pwa-v0.0.8';
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/Logo_qsd.png',
  '/lib/resolve-story-image.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys.map(key => (key === CACHE ? Promise.resolve(false) : caches.delete(key)))
        )
      )
      .catch(() => {})
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/** Network-first for HTML documents (non-navigation fetches included). */
function networkFirstHtml(request) {
  return (async () => {
    try {
      return await fetch(request);
    } catch {
      const cached =
        (await caches.match(request)) ||
        (await caches.match('/')) ||
        (await caches.match('/offline.html'));
      if (cached) return cached;
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })();
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Editorial/API: always network — no stale JSON/HTML from SW cache.
  if (isSameOrigin && url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req));
    return;
  }

  // Navigations: network-first; offline falls back to cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(networkFirstHtml(req));
    return;
  }

  // Explicit HTML paths (e.g. fetch of /index.html): network-first.
  if (isSameOrigin && url.pathname.endsWith('.html')) {
    event.respondWith(networkFirstHtml(req));
    return;
  }

  // Static assets: cache-first; populate cache on successful fetch.
  if (isSameOrigin && /\.(?:css|js|png|svg|woff2|webmanifest)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return cached || new Response(null, { status: 504 });
      }
    })());
  }
});
