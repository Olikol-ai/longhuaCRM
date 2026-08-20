/**
 * Soft gate: defer hard reloads while a live video lesson is active.
 * Kept free of React so frontendUpdate / SW client can import it safely.
 */
let videoSessionBlocksReload = false;
/** @type {Set<() => void>} */
const listeners = new Set();

export function setVideoSessionBlocksReload(blocked) {
  const next = Boolean(blocked);
  if (next === videoSessionBlocksReload) return;
  videoSessionBlocksReload = next;
  listeners.forEach((fn) => {
    try {
      fn(videoSessionBlocksReload);
    } catch {
      /* ignore */
    }
  });
}

export function shouldDeferAppReload() {
  return videoSessionBlocksReload;
}

export function onVideoSessionReloadGateChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
