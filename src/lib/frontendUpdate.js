/**
 * Production-grade frontend update recovery after Vite deploy.
 * UI copy lives in FrontendUpdateScreen — this module is logic + diagnostics only.
 */
import { lazy } from 'react';

export const CHUNK_RELOAD_STORAGE_KEY = 'lh_chunk_auto_reload_at';
export const FRONTEND_UPDATE_NAV_KEY = 'lh_frontend_update_nav';
export const FRONTEND_UPDATE_EVENTS_KEY = 'lh_frontend_update_events';

const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|Loading chunk|error loading dynamically imported module|ChunkLoadError|MIME type|text\/html/i;

const CHUNK_URL_RE = /https?:\/\/[^\s)'"]+\.js/i;

export function isChunkLoadError(error) {
  if (!error) return false;
  if (error.name === 'ChunkLoadError') return true;
  const message = String(error.message || error || '');
  return CHUNK_ERROR_RE.test(message);
}

export function extractChunkUrl(error) {
  const message = String(error?.message || error || '');
  const match = message.match(CHUNK_URL_RE);
  return match ? match[0] : null;
}

export function getFrontendBuildId() {
  if (typeof document === 'undefined') return 'unknown';
  try {
    const el = document.querySelector('script[type="module"][src*="/assets/index-"]');
    const src = el?.getAttribute('src') || '';
    const match = src.match(/index-([A-Za-z0-9_-]+)\.js/);
    if (match) return match[1];
  } catch {
    /* ignore */
  }
  return import.meta.env.PROD ? 'prod' : 'dev';
}

function cleanSearchParams(search) {
  const params = new URLSearchParams(search || '');
  params.delete('_r');
  params.delete('_chunk');
  const next = params.toString();
  return next ? `?${next}` : '';
}

/** Snapshot current route so reload returns the user to the same screen. */
export function saveNavigationStateForUpdate(extra = {}) {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return null;
  const snapshot = {
    pathname: window.location.pathname || '/',
    search: cleanSearchParams(window.location.search),
    hash: window.location.hash || '',
    savedAt: Date.now(),
    buildId: getFrontendBuildId(),
    ...extra,
  };
  try {
    sessionStorage.setItem(FRONTEND_UPDATE_NAV_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore quota */
  }
  return snapshot;
}

export function readNavigationStateForUpdate() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(FRONTEND_UPDATE_NAV_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.savedAt && Date.now() - Number(parsed.savedAt) > 10 * 60 * 1000) {
      sessionStorage.removeItem(FRONTEND_UPDATE_NAV_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearNavigationStateForUpdate() {
  try {
    sessionStorage.removeItem(FRONTEND_UPDATE_NAV_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * After a successful boot, strip recovery query params and confirm restored route.
 * Returns the restored snapshot (if any) for diagnostics.
 */
export function finalizeFrontendUpdateRecovery() {
  if (typeof window === 'undefined') return null;
  const snapshot = readNavigationStateForUpdate();
  const url = new URL(window.location.href);
  const hadRecoveryParam = url.searchParams.has('_r') || url.searchParams.has('_chunk');

  if (hadRecoveryParam) {
    url.searchParams.delete('_r');
    url.searchParams.delete('_chunk');
    const clean = `${url.pathname}${cleanSearchParams(url.search)}${url.hash}`;
    window.history.replaceState(window.history.state, '', clean);
  }

  if (snapshot?.pathname) {
    const target = `${snapshot.pathname}${snapshot.search || ''}${snapshot.hash || ''}`;
    const current = `${window.location.pathname}${cleanSearchParams(window.location.search)}${window.location.hash}`;
    if (target && target !== current && snapshot.pathname.startsWith('/')) {
      // Prefer staying on the URL the reload already opened; only correct drift.
      try {
        window.history.replaceState(window.history.state, '', target);
      } catch {
        /* ignore */
      }
    }
    clearNavigationStateForUpdate();
    recordFrontendUpdateEvent({
      type: 'frontend_update_recovered',
      reason: 'boot',
      restoredPath: target,
    });
  } else if (hadRecoveryParam) {
    recordFrontendUpdateEvent({
      type: 'frontend_update_recovered',
      reason: 'boot_clean_param',
    });
  }

  return snapshot;
}

/**
 * Internal diagnostic event — never shown in UI.
 * Kept in sessionStorage (last 20) + console for release triage.
 */
export function recordFrontendUpdateEvent(event = {}) {
  const payload = {
    at: new Date().toISOString(),
    type: event.type || 'frontend_update',
    errorName: event.errorName || null,
    errorMessage: event.errorMessage || null,
    chunkUrl: event.chunkUrl || null,
    route:
      event.route ||
      (typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : null),
    buildId: event.buildId || getFrontendBuildId(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    reason: event.reason || null,
    restoredPath: event.restoredPath || null,
  };

  try {
    console.info('[Longhua] frontend_update_event', payload);
  } catch {
    /* ignore */
  }

  if (typeof sessionStorage === 'undefined') return payload;
  try {
    const prev = JSON.parse(sessionStorage.getItem(FRONTEND_UPDATE_EVENTS_KEY) || '[]');
    const list = Array.isArray(prev) ? prev : [];
    list.push(payload);
    sessionStorage.setItem(FRONTEND_UPDATE_EVENTS_KEY, JSON.stringify(list.slice(-20)));
  } catch {
    /* ignore */
  }
  return payload;
}

export function logChunkLoadError(error, info = null) {
  const chunkUrl = extractChunkUrl(error);
  recordFrontendUpdateEvent({
    type: 'chunk_load_error',
    errorName: error?.name || 'ChunkLoadError',
    errorMessage: error?.message ? String(error.message) : String(error || ''),
    chunkUrl,
    reason: 'deploy_or_stale_shell',
  });
  console.error('[Longhua] Frontend update required (stale chunk after deploy)', {
    name: error?.name || 'ChunkLoadError',
    message: error?.message ? String(error.message) : String(error || ''),
    chunkUrl,
    stack: error?.stack || null,
    componentStack: info?.componentStack || null,
    href: typeof window !== 'undefined' ? window.location.href : null,
    buildId: getFrontendBuildId(),
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

/**
 * Full document navigation to the saved (or current) route with a fresh index.html.
 */
export async function hardReloadForStaleChunks(reason = 'chunk') {
  const snapshot =
    saveNavigationStateForUpdate({ reason }) ||
    {
      pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
      search: typeof window !== 'undefined' ? cleanSearchParams(window.location.search) : '',
      hash: typeof window !== 'undefined' ? window.location.hash : '',
    };

  recordFrontendUpdateEvent({
    type: 'frontend_update_reload',
    reason,
    route: `${snapshot.pathname}${snapshot.search || ''}${snapshot.hash || ''}`,
  });

  try {
    await clearClientModuleCaches();
  } catch {
    /* still reload */
  }

  const targetPath = snapshot.pathname || '/';
  const targetSearch = cleanSearchParams(snapshot.search || '');
  const targetHash = snapshot.hash || '';
  // Cache-bust only via ephemeral param; navigation state is in sessionStorage.
  const sep = targetSearch ? '&' : '?';
  window.location.replace(
    `${targetPath}${targetSearch}${sep}_r=${encodeURIComponent(`${reason}-${Date.now()}`)}${targetHash}`,
  );
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
