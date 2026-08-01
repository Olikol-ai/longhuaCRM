/**
 * React.lazy wrapper that recovers from stale Vite chunks after deploy.
 * One automatic hard reload per short window; then surface the error.
 */
import { lazy } from 'react';

export const CHUNK_RELOAD_STORAGE_KEY = 'lh_chunk_auto_reload_at';

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Loading chunk|error loading dynamically imported module|ChunkLoadError|MIME type|text\/html/i;

export function isChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return CHUNK_ERROR_RE.test(message);
}

export async function clearClientModuleCaches() {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Hard navigation that bypasses stale HTML / module graph after a deploy.
 */
export async function hardReloadForStaleChunks(reason = 'chunk') {
  await clearClientModuleCaches();
  const url = new URL(window.location.href);
  url.searchParams.set('_r', `${reason}-${Date.now()}`);
  window.location.replace(url.toString());
}

/** True once per ~20s window — prevents reload loops after a bad deploy. */
export function claimChunkAutoReload() {
  if (typeof sessionStorage === 'undefined') return false;
  const raw = sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY);
  const last = raw ? Number(raw) : 0;
  if (Number.isFinite(last) && Date.now() - last < 20_000) {
    return false;
  }
  sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(Date.now()));
  return true;
}

/**
 * @template T
 * @param {() => Promise<{ default: T }>} factory
 */
export function lazyRetry(factory) {
  return lazy(() =>
    factory().catch(async (error) => {
      if (isChunkLoadError(error) && claimChunkAutoReload()) {
        await hardReloadForStaleChunks('lazy');
        // Keep Suspense pending while the document unloads.
        return new Promise(() => {});
      }
      throw error;
    }),
  );
}
