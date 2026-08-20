/**
 * Pure SW resource classification — unit-tested.
 * Must stay semantically aligned with `public/sw.js` (contract test enforces markers).
 */

export function isCrossOrigin(url, selfOrigin) {
  return url.origin !== selfOrigin;
}

export function isApiRequest(url) {
  return url.pathname.startsWith('/api');
}

export function isSocketRequest(url) {
  return url.pathname.startsWith('/socket.io');
}

export function isUploadRequest(url) {
  return url.pathname.startsWith('/uploads') || url.pathname.startsWith('/files/upload');
}

export function hasAuthQueryToken(url) {
  try {
    if (url.searchParams.has('access_token')) return true;
    if (url.searchParams.has('token')) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Large / binary learning materials — never SW cache. */
export function isMaterialMediaPath(url) {
  const path = url.pathname || '';
  if (path.startsWith('/api/files')) return true;
  if (path.startsWith('/uploads')) return true;
  return /\.(pdf|docx?|pptx?|xlsx?|zip|rar|7z|mp3|wav|ogg|m4a|mp4|webm|mov|avi)(\?|$)/i.test(
    path,
  );
}

export function isNavigationRequest(request, url) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers?.get?.('accept') || '';
  if (accept.includes('text/html')) return true;
  if (url.pathname === '/' || url.pathname.endsWith('.html')) return true;
  return false;
}

/** Vite hashed bundles under /assets/ */
export function isVersionedStaticAsset(url) {
  if (!url.pathname.startsWith('/assets/')) return false;
  return /\.[a-z0-9]+$/i.test(url.pathname) || /-[A-Za-z0-9_-]{6,}\.(js|css|mjs|cjs|woff2?|svg|png|jpg|jpeg|webp|avif)(\?|$)/i.test(url.pathname);
}

export function isScriptOrStylePath(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    /\.(js|mjs|cjs|css)(\?|$)/i.test(url.pathname)
  );
}

export function isIconOrManifest(url) {
  return (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.ico' ||
    url.pathname.endsWith('.webmanifest')
  );
}

export function isHtmlContentType(response) {
  const type = response?.headers?.get?.('content-type') || '';
  return type.includes('text/html');
}

/**
 * Full bypass: SW must not respondWith.
 * Jitsi is cross-origin → covered by isCrossOrigin.
 */
export function shouldBypassServiceWorker(url, selfOrigin) {
  if (isCrossOrigin(url, selfOrigin)) return true;
  if (isApiRequest(url)) return true;
  if (isSocketRequest(url)) return true;
  if (isUploadRequest(url)) return true;
  if (hasAuthQueryToken(url)) return true;
  if (isMaterialMediaPath(url)) return true;
  return false;
}

export function pwaCacheName(buildId) {
  return `longhua-academy-pwa-${buildId}`;
}
