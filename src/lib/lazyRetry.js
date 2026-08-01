/**
 * Recover from stale Vite chunks after deploy.
 *
 * Do NOT hang Suspense on an unresolved promise — always throw so
 * AppErrorBoundary can show the update message and reload once.
 */
import { lazy } from 'react';

export const CHUNK_RELOAD_STORAGE_KEY = 'lh_chunk_auto_reload_at';
export const CHUNK_UPDATE_MESSAGE =
  'Приложение было обновлено. Страница будет автоматически перезагружена.';

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Loading chunk|error loading dynamically imported module|ChunkLoadError|MIME type|text\/html/i;

export function isChunkLoadError(error) {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  const message = String(error.message || error || '');
  return CHUNK_ERROR_RE.test(message);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    }),
  ]);
}

export async function clearClientModuleCaches() {
  const tasks = [];
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      tasks.push(
        navigator.serviceWorker.getRegistrations().then((regs) =>
          Promise.all(regs.map((reg) => reg.unregister())),
        ),
      );
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof caches !== 'undefined') {
      tasks.push(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
    }
  } catch {
    /* ignore */
  }
  if (tasks.length) {
    await withTimeout(Promise.allSettled(tasks), 1500);
  }
}

/**
 * Full document navigation so the browser re-fetches index.html (not a soft remount).
 */
export async function hardReloadForStaleChunks(reason = 'chunk') {
  try {
    await clearClientModuleCaches();
  } catch {
    /* still reload */
  }
  const url = new URL(window.location.href);
  url.searchParams.delete('_r');
  url.searchParams.set('_r', `${reason}-${Date.now()}`);
  // replace() avoids stacking history entries on repeated recoveries
  window.location.replace(`${url.pathname}${url.search}${url.hash}`);
}

/** True once per ~30s window — prevents reload loops. Manual retry bypasses this. */
export function claimChunkAutoReload() {
  if (typeof sessionStorage === 'undefined') return false;
  const raw = sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY);
  const last = raw ? Number(raw) : 0;
  if (Number.isFinite(last) && Date.now() - last < 30_000) {
    return false;
  }
  sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(Date.now()));
  return true;
}

export function markChunkLoadError(error) {
  const err = error instanceof Error ? error : new Error(String(error || 'ChunkLoadError'));
  err.name = 'ChunkLoadError';
  if (!err.message || err.message === 'Error') {
    err.message = 'Failed to fetch dynamically imported module';
  }
  return err;
}

/**
 * @template T
 * @param {() => Promise<{ default: T }>} factory
 */
export function lazyRetry(factory) {
  return lazy(() =>
    factory().catch((error) => {
      // Always rethrow — ErrorBoundary owns messaging + one auto-reload.
      throw markChunkLoadError(error);
    }),
  );
}
