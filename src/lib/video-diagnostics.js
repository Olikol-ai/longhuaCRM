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

function videoErrorText(raw) {
  return String(
    typeof raw === 'string'
      ? raw
      : raw?.message || raw?.error || raw?.error?.message || raw?.code || '',
  )
    .trim()
    .toLowerCase();
}

/** Auth/JWT errors — refresh token + controlled remount, do not navigate away. */
export function isAuthVideoError(raw) {
  const text = videoErrorText(raw);
  if (!text) return false;
  return (
    text.includes('token') ||
    text.includes('jwt') ||
    text.includes('unauthorized') ||
    text.includes('not-authorized') ||
    text.includes('expir')
  );
}

/** Device permission errors — user action required; keep CRM session for retry. */
export function isMediaPermissionVideoError(raw) {
  const text = videoErrorText(raw);
  return (
    text.includes('not-allowed') ||
    text.includes('permission') ||
    text.includes('denied') ||
    text.includes('getusermedia')
  );
}

/**
 * Transient = keep CRM session, prefer soft recovery (no endSession).
 * Almost all network/conference flaps are transient. Auth is "soft remount",
 * not endSession. Only blank unknown after join still treated as recoverable.
 */
export function isTransientVideoError(raw) {
  const text = videoErrorText(raw);
  if (!text) return true;
  if (isMediaPermissionVideoError(raw)) return false;
  if (isAuthVideoError(raw)) return false;
  return true;
}

/** True when CRM must call endSession (not soft remount / interrupt). */
export function isUnrecoverableVideoFailure(raw) {
  // Media permission is recoverable via user grant + retry on same page.
  // Auth is recoverable via token refresh + remount.
  // Nothing else should destroy the lesson shell automatically.
  void raw;
  return false;
}
