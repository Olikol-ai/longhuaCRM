/**
 * Structured diagnostics for lesson video (Jitsi / WebRTC).
 * Keeps a ring buffer for support dumps; console logs stay readable.
 */

const MAX_EVENTS = 200;
const STORAGE_KEY = 'longhua_video_diag';

/** @type {Array<object>} */
let ring = [];

function nowIso() {
  return new Date().toISOString();
}

function push(event) {
  const row = {
    t: nowIso(),
    ...event,
  };
  ring.push(row);
  if (ring.length > MAX_EVENTS) {
    ring = ring.slice(-MAX_EVENTS);
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ring.slice(-80)));
    }
  } catch {
    // ignore quota / private mode
  }
  const level = event.level || 'info';
  const prefix = `[video-diag] ${row.t} ${event.type || 'event'}`;
  const payload = { ...row };
  delete payload.level;
  if (level === 'error') {
     
    console.error(prefix, payload);
  } else if (level === 'warn') {
     
    console.warn(prefix, payload);
  } else {
     
    console.info(prefix, payload);
  }
  return row;
}

export function videoDiag(type, details = {}, level = 'info') {
  return push({ type, level, ...details });
}

export function videoDiagError(type, details = {}) {
  return push({ type, level: 'error', ...details });
}

export function videoDiagWarn(type, details = {}) {
  return push({ type, level: 'warn', ...details });
}

export function getVideoDiagSnapshot() {
  return ring.slice();
}

export function clearVideoDiag() {
  ring = [];
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Classify whether a conference error is transient (keep session) vs fatal. */
export function isTransientVideoError(raw) {
  const text = String(
    typeof raw === 'string'
      ? raw
      : raw?.message || raw?.error || raw?.error?.message || raw?.code || '',
  )
    .trim()
    .toLowerCase();

  if (!text) return true;

  // Auth / permission — user must rejoin with a fresh token or grant devices.
  if (
    text.includes('token') ||
    text.includes('jwt') ||
    text.includes('unauthorized') ||
    text.includes('not-allowed') ||
    text.includes('permission') ||
    text.includes('denied') ||
    text.includes('getusermedia')
  ) {
    return false;
  }

  // Network / ICE / bridge flaps — Jitsi usually recovers without remount.
  if (
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('ice') ||
    text.includes('network') ||
    text.includes('offline') ||
    text.includes('connection') ||
    text.includes('conference') ||
    text.includes('websocket') ||
    text.includes('session-terminate') ||
    text.includes('unavailable') ||
    text.includes('failed to fetch')
  ) {
    return true;
  }

  return true;
}
