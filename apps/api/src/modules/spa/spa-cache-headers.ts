/**
 * Cache headers for SPA static responses.
 * Cloudflare "Browser Cache TTL" can override weak origin directives — use
 * no-store + CDN-Cache-Control so HTML / missing assets are not sticky.
 */
export function applyNoStoreCacheHeaders(res: {
  setHeader: (name: string, value: string) => void;
}): void {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
}

export function applyImmutableAssetCacheHeaders(res: {
  setHeader: (name: string, value: string) => void;
}): void {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
}

export function applySpaStaticFileHeaders(
  res: { setHeader: (name: string, value: string) => void },
  filePath: string,
): void {
  const normalized = String(filePath).replace(/\\/g, '/');
  if (normalized.includes('/assets/')) {
    applyImmutableAssetCacheHeaders(res);
    return;
  }
  if (
    normalized.endsWith('/index.html') ||
    normalized.endsWith('index.html') ||
    normalized.endsWith('/sw.js') ||
    normalized.endsWith('sw.js')
  ) {
    applyNoStoreCacheHeaders(res);
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');
}
