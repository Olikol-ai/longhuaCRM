/* Longhua Academy — installability SW (network-first). */
/* Bump CACHE when icons change. Never precache index.html — stale HTML → broken hashed chunks. */
const CACHE = 'longhua-academy-shell-v5-20260801b';
const PRECACHE = [
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/favicon-16x16.png',
  '/icons/favicon-32x32.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

function isScriptOrStyleRequest(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    /\.(js|mjs|cjs|css)(\?|$)/i.test(url.pathname)
  );
}

function isHtmlNavigation(request, url) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) return true;
  if (url.pathname === '/' || url.pathname.endsWith('.html')) return true;
  return false;
}

function isHtmlContentType(response) {
  const type = response.headers.get('content-type') || '';
  return type.includes('text/html');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API — always network
  if (url.pathname.startsWith('/api')) return;

  // HTML shell must always come from network so hashed chunk URLs stay current.
  if (isHtmlNavigation(request, url)) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      }),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Server SPA fallback must never be treated as a JS/CSS module.
        if (isScriptOrStyleRequest(url) && isHtmlContentType(response)) {
          return new Response('Not found', {
            status: 404,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }

        // Only cache icons / manifest — never /assets/* (immutable on CDN) or HTML.
        const copy = response.clone();
        if (
          response.ok &&
          (url.pathname.startsWith('/icons/') ||
            url.pathname === '/favicon.ico' ||
            url.pathname.endsWith('.webmanifest'))
        ) {
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Never serve the HTML shell for JS/CSS — causes MIME type errors.
        if (isScriptOrStyleRequest(url)) {
          return new Response('Not found', {
            status: 404,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }),
  );
});
