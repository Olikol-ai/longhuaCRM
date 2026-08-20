/**
 * Deterministic PWA / frontend build identity (Stage 1 SSOT).
 * Vite injects VITE_LH_PWA_BUILD_ID at build time; stamp script syncs public/sw.js + manifest.
 */
export const LH_PWA_BUILD_ID =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_LH_PWA_BUILD_ID) ||
  'dev';

export const LH_PWA_CACHE_PREFIX = 'longhua-academy-pwa';

export function getLhPwaBuildId() {
  return String(LH_PWA_BUILD_ID || 'dev');
}

export function pwaAssetUrl(path) {
  const clean = String(path || '').startsWith('/') ? String(path) : `/${path}`;
  return `${clean}?v=${encodeURIComponent(getLhPwaBuildId())}`;
}

export function serviceWorkerScriptUrl() {
  return `/sw.js?v=${encodeURIComponent(getLhPwaBuildId())}`;
}

export function pwaCacheName() {
  return `${LH_PWA_CACHE_PREFIX}-${getLhPwaBuildId()}`;
}
