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

/** Favicon / PWA icons / manifest: revalidate so brand updates reach users without a manual cache wipe. */
export function applyIconAssetCacheHeaders(res: {
  setHeader: (name: string, value: string) => void;
}): void {
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('CDN-Cache-Control', 'no-cache');
  res.setHeader('Cloudflare-CDN-Cache-Control', 'no-cache');
}

function isIconOrManifestPath(normalized: string): boolean {
  if (normalized.endsWith('.webmanifest')) return true;
  if (normalized.endsWith('/favicon.ico') || normalized.endsWith('favicon.ico')) return true;
  if (normalized.endsWith('/icon-master.png') || normalized.endsWith('icon-master.png')) {
    return true;
  }
  if (normalized.includes('/icons/')) return true;
  return false;
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
  if (isIconOrManifestPath(normalized)) {
    applyIconAssetCacheHeaders(res);
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');
}
