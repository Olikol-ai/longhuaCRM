/**
 * Recover from stale Vite chunks after deploy.
 *
 * Do NOT hang Suspense on an unresolved promise — always throw so
 * AppErrorBoundary can show the update screen and reload once.
 */
import { lazy } from 'react';

export const CHUNK_RELOAD_STORAGE_KEY = 'lh_chunk_auto_reload_at';

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Loading chunk|error loading dynamically imported module|ChunkLoadError|MIME type|text\/html/i;

const CHUNK_URL_RE = /https?:\/\/[^\s)'"]+\.js/i;

export function isChunkLoadError(error) {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  const message = String(error.message || error || '');
  return CHUNK_ERROR_RE.test(message);
}

/** Extract chunk URL / filename for developer logs only. */
export function extractChunkUrl(error) {
  const message = String(error?.message || error || '');
  const match = message.match(CHUNK_URL_RE);
  if (match) return match[0];
  return null;
}

/**
 * Log technical deploy/chunk details for developers — never for the UI.
 */
export function logChunkLoadError(error, info = null) {
  const chunkUrl = extractChunkUrl(error);
  console.error('[Longhua] Frontend update required (stale chunk after deploy)', {
    name: error?.name || 'ChunkLoadError',
    message: error?.message ? String(error.message) : String(error || ''),
    chunkUrl,
    stack: error?.stack || null,
    componentStack: info?.componentStack || null,
    href: typeof window !== 'undefined' ? window.location.href : null,
  });
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
      throw markChunkLoadError(error);
    }),
  );
}
