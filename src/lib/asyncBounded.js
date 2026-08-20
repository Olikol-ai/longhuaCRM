/**
 * Race a promise against a wall-clock bound.
 * Never used as a substitute for clearing auth — only for optional I/O.
 */
export function withTimeout(promise, ms, fallback = null) {
  const timeoutMs = Math.max(0, Number(ms) || 0);
  if (!timeoutMs) {
    return Promise.resolve(promise).catch(() => fallback);
  }
  let timer = null;
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
