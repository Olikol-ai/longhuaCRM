/**
 * Network connectivity for offline-read UX.
 * navigator.onLine is NOT absolute truth — API failures can mark degraded.
 */

/** @typedef {'online' | 'degraded' | 'offline' | 'recovering'} OfflineMode */

/** @type {OfflineMode} */
let mode = typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online';

/** @type {Set<(state: { mode: OfflineMode, at: number }) => void>} */
const listeners = new Set();

let lastChangeAt = Date.now();
let recoverToastArmed = false;

function emit() {
  const state = getOfflineNetworkState();
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch {
      /* ignore */
    }
  });
}

function setMode(next) {
  if (mode === next) return;
  const prev = mode;
  mode = next;
  lastChangeAt = Date.now();
  if ((prev === 'offline' || prev === 'degraded') && next === 'online') {
    recoverToastArmed = true;
  }
  emit();
}

export function getOfflineNetworkState() {
  return { mode, at: lastChangeAt };
}

export function getOfflineMode() {
  return mode;
}

export function isOfflineMode() {
  return mode === 'offline' || mode === 'degraded';
}

export function subscribeOfflineNetwork(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markNetworkOnline() {
  setMode('online');
}

export function markNetworkOffline() {
  setMode('offline');
}

export function markNetworkDegraded() {
  // Online flag but API unreachable.
  setMode('degraded');
}

export function markNetworkRecovering() {
  setMode('recovering');
}

/** Consume one-shot “connection restored” toast flag. */
export function consumeRecoveredToast() {
  if (!recoverToastArmed) return false;
  recoverToastArmed = false;
  return true;
}

export function isLikelyNetworkError(err) {
  if (!err) return false;
  if (err.name === 'TypeError') return true;
  if (err.status === 0) return true;
  const msg = String(err.message || err || '').toLowerCase();
  return (
    msg.includes('network')
    || msg.includes('failed to fetch')
    || msg.includes('сеть')
    || msg.includes('offline')
    || msg.includes('internet')
  );
}

export function bindOfflineNetworkListeners() {
  if (typeof window === 'undefined') return () => {};

  const onOnline = () => {
    markNetworkRecovering();
    // Soft: wait for a successful API call to confirm online.
    // Still flip to online for UX; real confirmation via markNetworkOnline on fetch success.
    markNetworkOnline();
  };
  const onOffline = () => markNetworkOffline();

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  if (navigator.onLine === false) {
    markNetworkOffline();
  }

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

/** Test helper */
export function resetOfflineNetworkStateForTests(next = 'online') {
  mode = next;
  lastChangeAt = Date.now();
  recoverToastArmed = false;
}
