import { getSnapshot, putSnapshot } from './offlineRepository.js';
import {
  isLikelyNetworkError,
  markNetworkDegraded,
  markNetworkOffline,
  markNetworkOnline,
} from './offlineStatus.js';

/**
 * Online: run fetcher, save snapshot, return fresh data.
 * Offline / network fail: return last snapshot if present.
 *
 * @returns {Promise<{
 *   data: unknown,
 *   fromCache: boolean,
 *   updatedAt: number | null,
 *   missing: boolean,
 * }>}
 */
export async function readWithOfflineFallback({
  userId,
  role,
  resource,
  resourceKey = 'default',
  fetcher,
  ttlMs,
}) {
  if (!userId) {
    throw new Error('readWithOfflineFallback requires userId');
  }

  try {
    const data = await fetcher();
    markNetworkOnline();
    const record = await putSnapshot({
      userId,
      role,
      resource,
      resourceKey,
      data,
      source: 'api',
      ttlMs,
    });
    return {
      data,
      fromCache: false,
      updatedAt: record.updatedAt,
      missing: false,
    };
  } catch (err) {
    const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (browserOffline) {
      markNetworkOffline();
    } else if (isLikelyNetworkError(err)) {
      markNetworkDegraded();
    } else {
      // Non-network errors (4xx/5xx) — do not silently serve stale as if offline OK.
      // Still allow fallback when status is 0 / missing.
      if (err?.status && err.status >= 400 && err.status < 600) {
        throw err;
      }
      if (!isLikelyNetworkError(err) && err?.status !== 0) {
        throw err;
      }
      markNetworkDegraded();
    }

    const snap = await getSnapshot({
      userId,
      role,
      resource,
      resourceKey,
      allowExpired: true,
    });
    if (snap) {
      return {
        data: snap.data,
        fromCache: true,
        updatedAt: snap.updatedAt,
        missing: false,
      };
    }
    return {
      data: null,
      fromCache: true,
      updatedAt: null,
      missing: true,
      error: err,
    };
  }
}
