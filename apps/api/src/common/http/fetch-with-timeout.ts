/**
 * Compose a hard client timeout with an optional external AbortSignal.
 * Relies on Node 20+ AbortSignal.timeout / AbortSignal.any.
 */
export function createTimeoutSignal(
  timeoutMs: number,
  external?: AbortSignal,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!external) {
    return timeout;
  }
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([timeout, external]);
  }
  // Fallback for older runtimes: race via AbortController.
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (external.aborted || timeout.aborted) {
    controller.abort();
    return controller.signal;
  }
  external.addEventListener('abort', abort, { once: true });
  timeout.addEventListener('abort', abort, { once: true });
  return controller.signal;
}
