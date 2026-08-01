/**
 * Paths that must never receive the SPA index.html fallback.
 * Returning HTML for a missing .js chunk causes:
 *   "text/html is not a valid JavaScript MIME type"
 */
const STATIC_FILE_EXT_RE =
  /\.(js|mjs|cjs|css|map|json|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|eot|txt|webmanifest|mp3|mp4|wasm)$/i;

export function normalizeRequestPathname(urlOrPath: string): string {
  const raw = String(urlOrPath || '');
  const noQuery = raw.split('?')[0] || '';
  if (!noQuery) return '/';
  return noQuery.startsWith('/') ? noQuery : `/${noQuery}`;
}

export function isStaticAssetRequestPath(urlOrPath: string): boolean {
  const pathname = normalizeRequestPathname(urlOrPath);
  if (pathname.startsWith('/assets/')) return true;
  if (pathname.startsWith('/icons/')) return true;
  return STATIC_FILE_EXT_RE.test(pathname);
}
