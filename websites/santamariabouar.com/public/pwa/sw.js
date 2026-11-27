/* Santa Maria Bouar account/gate PWA — installability + light static cache */
const CACHE_NAME = 'smb-pwa-v1';
const PRECACHE = [
  '/css/styles.css',
  '/js/script.js',
  '/js/account-pwa.js',
  '/js/account-gate-auto.js',
  '/js/account-open-gate.js',
  '/pwa/icons/account-192.png',
  '/pwa/icons/gate-192.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first for HTML /account navigations (auth + CSRF must stay fresh)
  const acceptsHtml = (request.headers.get('accept') || '').includes('text/html');
  if (acceptsHtml || url.pathname.startsWith('/account')) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for precached static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && (url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/') || url.pathname.startsWith('/pwa/'))) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
