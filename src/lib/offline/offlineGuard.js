import { OFFLINE_MUTATION_MESSAGE } from './constants.js';
import { isOfflineMode, isLikelyNetworkError, markNetworkDegraded, markNetworkOffline } from './offlineStatus.js';

export class OfflineMutationError extends Error {
  constructor(message = OFFLINE_MUTATION_MESSAGE) {
    super(message);
    this.name = 'OfflineMutationError';
    this.code = 'OFFLINE_MUTATION';
    this.status = 0;
  }
}

export function assertOnlineForMutation() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    markNetworkOffline();
    throw new OfflineMutationError();
  }
  if (isOfflineMode()) {
    throw new OfflineMutationError();
  }
}

export function isMutationMethod(method) {
  const m = String(method || 'GET').toUpperCase();
  return m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS';
}

/**
 * Call after a failed fetch to update connectivity mode.
 */
export function noteFetchFailure(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    markNetworkOffline();
    return;
  }
  if (isLikelyNetworkError(err)) {
    markNetworkDegraded();
  }
}
