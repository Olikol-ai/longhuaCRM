/* Longhua Academy — Stage 2 Service Worker foundation (NOT offline product / NOT push). */
/* BUILD_ID placeholder stamped at Vite build into dist/sw.js. */
/* Classifiers mirrored in src/lib/pwa/swResourceRules.js — keep markers in sync. */
const BUILD_ID = '__LH_PWA_BUILD_ID__';
const CACHE = `longhua-academy-pwa-${BUILD_ID}`;
const PRECACHE = [
  `/manifest.webmanifest?v=${BUILD_ID}`,
  `/favicon.ico?v=${BUILD_ID}`,
  `/icons/favicon-16x16.png?v=${BUILD_ID}`,
  `/icons/favicon-32x32.png?v=${BUILD_ID}`,
  `/icons/favicon-48.png?v=${BUILD_ID}`,
  `/icons/apple-touch-icon.png?v=${BUILD_ID}`,
  `/icons/icon-192.png?v=${BUILD_ID}`,
  `/icons/icon-512.png?v=${BUILD_ID}`,
  `/icons/icon-maskable-192.png?v=${BUILD_ID}`,
  `/icons/icon-maskable-512.png?v=${BUILD_ID}`,
];

/* ---- classifiers (Stage 2) ---- */

function isApiRequest(url) {
  return url.pathname.startsWith('/api');
}

function isSocketRequest(url) {
  return url.pathname.startsWith('/socket.io');
}

function isUploadRequest(url) {
  return url.pathname.startsWith('/uploads') || url.pathname.startsWith('/files/upload');
}

function hasAuthQueryToken(url) {
  try {
    if (url.searchParams.has('access_token')) return true;
    if (url.searchParams.has('token')) return true;
  } catch (_) {
    /* ignore */
  }
  return false;
}

function isMaterialMediaPath(url) {
  const path = url.pathname || '';
  if (path.startsWith('/api/files')) return true;
  if (path.startsWith('/uploads')) return true;
  return /\.(pdf|docx?|pptx?|xlsx?|zip|rar|7z|mp3|wav|ogg|m4a|mp4|webm|mov|avi)(\?|$)/i.test(path);
}

function isNavigationRequest(request, url) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) return true;
  if (url.pathname === '/' || url.pathname.endsWith('.html')) return true;
  return false;
}

function isVersionedStaticAsset(url) {
  if (!url.pathname.startsWith('/assets/')) return false;
  return (
    /\.[a-z0-9]+$/i.test(url.pathname) ||
    /-[A-Za-z0-9_-]{6,}\.(js|css|mjs|cjs|woff2?|svg|png|jpg|jpeg|webp|avif)(\?|$)/i.test(
      url.pathname,
    )
  );
}

function isScriptOrStylePath(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    /\.(js|mjs|cjs|css)(\?|$)/i.test(url.pathname)
  );
}

function isIconOrManifest(url) {
  return (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.ico' ||
    url.pathname.endsWith('.webmanifest')
  );
}

function isHtmlContentType(response) {
  const type = response.headers.get('content-type') || '';
  return type.includes('text/html');
}

function shouldBypass(url) {
  // Cross-origin (Jitsi CDN / WebRTC / fonts) — do not intercept.
  if (url.origin !== self.location.origin) return true;
  if (isApiRequest(url)) return true;
  if (isSocketRequest(url)) return true;
  if (isUploadRequest(url)) return true;
  if (hasAuthQueryToken(url)) return true;
  if (isMaterialMediaPath(url)) return true;
  return false;
}

function htmlAsJsGuardResponse() {
  return new Response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/* ---- lifecycle ---- */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE);
      // Do NOT skipWaiting on update while tabs are open — client sends SKIP_WAITING
      // after user confirms (and never during VideoSession).
      // First install (no active worker yet): activate immediately.
      if (!self.registration.active) {
        await self.skipWaiting();
      }
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('longhua-academy-') && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({ type: 'VERSION', buildId: BUILD_ID, cache: CACHE });
    return;
  }
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ---- fetch ---- */

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (_) {
    return;
  }

  if (shouldBypass(url)) return;

  // CLASS A — App shell / navigation: NETWORK FIRST (never cache-first HTML).
  if (isNavigationRequest(request, url)) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // CLASS B — Versioned hashed assets: CACHE FIRST (immutable filenames).
  if (isVersionedStaticAsset(url)) {
    event.respondWith(cacheFirstVersionedAsset(request, url));
    return;
  }

  // Icons / manifest: network with cache fill (identity assets).
  if (isIconOrManifest(url)) {
    event.respondWith(networkThenCacheIcons(request, url));
    return;
  }

  // Default same-origin GET: network only, no cache (safe default).
  event.respondWith(
    fetch(request).catch(() =>
      isScriptOrStylePath(url)
        ? htmlAsJsGuardResponse()
        : new Response('Offline', { status: 503, statusText: 'Offline' }),
    ),
  );
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      try {
        await cache.put(request, response.clone());
      } catch (_) {
        /* opaque / quota — ignore */
      }
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    return (
      cached ||
      new Response('Offline', { status: 503, statusText: 'Offline' })
    );
  }
}

async function cacheFirstVersionedAsset(request, url) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) {
    if (isScriptOrStylePath(url) && isHtmlContentType(hit)) {
      await cache.delete(request);
    } else {
      return hit;
    }
  }

  try {
    const response = await fetch(request);
    if (isScriptOrStylePath(url) && isHtmlContentType(response)) {
      return htmlAsJsGuardResponse();
    }
    if (response && response.ok) {
      try {
        await cache.put(request, response.clone());
      } catch (_) {
        /* ignore */
      }
    }
    return response;
  } catch (_) {
    return htmlAsJsGuardResponse();
  }
}

async function networkThenCacheIcons(request, url) {
  try {
    const response = await fetch(request);
    if (response && response.ok && isIconOrManifest(url)) {
      const cache = await caches.open(CACHE);
      try {
        await cache.put(request, response.clone());
      } catch (_) {
        /* ignore */
      }
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    return (
      cached ||
      new Response('Offline', { status: 503, statusText: 'Offline' })
    );
  }
}

/* ---- Stage 4: Web Push ---- */
/* Push path must NEVER: cache payload, store JWT, call skipWaiting, touch API/Socket/Jitsi caches. */

self.addEventListener('push', (event) => {
  let data = {
    title: 'Longhua CRM',
    body: 'Новое уведомление',
    deepLink: '/',
    notificationId: null,
    eventId: null,
    type: 'system.announcement',
    timestamp: Date.now(),
  };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (_) {
    try {
      const text = event.data && event.data.text();
      if (text) data.body = String(text).slice(0, 180);
    } catch (_) {
      /* ignore */
    }
  }

  // Display only — do not write business/SSOT data into Cache Storage or browser storage APIs.
  const title = String(data.title || 'Longhua CRM');
  const options = {
    body: String(data.body || ''),
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-48.png',
    tag: String(data.eventId || data.notificationId || data.type || 'longhua'),
    renotify: true,
    data: {
      deepLink: data.deepLink || '/',
      notificationId: data.notificationId,
      eventId: data.eventId,
      type: data.type,
    },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const deepLink =
    (event.notification && event.notification.data && event.notification.data.deepLink) || '/';
  // Deep link is a route hint only — ACL/API remain the authority after open.
  const targetUrl = new URL(deepLink, self.location.origin).href;
  const targetPath = new URL(targetUrl).pathname + new URL(targetUrl).search;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if ('focus' in client) {
          try {
            await client.focus();
            // Prefer soft client navigate (SPA) so VideoSession can defer via reloadGate.
            // Avoid Client.navigate hard reload when a same-origin client already exists.
            client.postMessage({ type: 'NOTIFICATION_NAVIGATE', url: deepLink || targetPath });
            return;
          } catch (_) {
            /* try next */
          }
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});

self.addEventListener('notificationclose', () => {
  /* no-op — no cache / JWT side effects */
});
