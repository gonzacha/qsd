const CACHE = 'qsd-pwa-v0.0.2';
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/api/rank',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/Logo_qsd.png',
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
      .then(keys => Promise.all(keys.map(key => (key === CACHE ? null : caches.delete(key)))))
      .catch(() => {})
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('/', res.clone());
        return res;
      } catch {
        const cached = await caches.match('/');
        if (cached) return cached;
        const offline = await caches.match('/offline.html');
        if (offline) return offline;
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  if (isSameOrigin && url.pathname === '/api/rank') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req)
        .then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(fetchPromise);
        return cached;
      }

      const res = await fetchPromise;
      if (res) return res;
      return new Response(
        JSON.stringify({ generatedAt: new Date().toISOString(), items: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    })());
    return;
  }

  if (isSameOrigin && /\.(?:css|js|png|svg|woff2)$/.test(url.pathname)) {
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
