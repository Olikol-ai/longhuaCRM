import {
  getLhPwaBuildId,
  serviceWorkerScriptUrl,
} from '@/lib/pwa/buildIdentity';
import { shouldDeferAppReload } from '@/lib/pwa/reloadGate';
import {
  hardReloadForStaleChunks,
  recordFrontendUpdateEvent,
  saveNavigationStateForUpdate,
} from '@/lib/frontendUpdate';

/**
 * @typedef {'idle'|'updating'|'manual'|'deferred'|'available'} UpdatePhase
 */

/** @type {null | ((phase: UpdatePhase, reason: string) => void)} */
let updateUiHandler = null;

/** @type {ServiceWorkerRegistration | null} */
let lastRegistration = null;

export function setPwaUpdateUiHandler(handler) {
  updateUiHandler = typeof handler === 'function' ? handler : null;
}

export function getServiceWorkerRegistration() {
  return lastRegistration;
}

function requestUpdateUi(phase, reason) {
  recordFrontendUpdateEvent({
    type: 'pwa_update_ui',
    reason,
    phase,
    buildId: getLhPwaBuildId(),
  });
  if (updateUiHandler) {
    updateUiHandler(phase, reason);
    return;
  }
  // Before React mounts: never hard-reload during video; never auto-reload for SW.
}

/**
 * Ask waiting worker to activate, then perform controlled document reload.
 * Must not be called while VideoSession is active.
 */
export async function activateWaitingServiceWorkerAndReload(reason = 'sw_update') {
  if (shouldDeferAppReload()) {
    requestUpdateUi('deferred', `${reason}_blocked_video`);
    return;
  }

  saveNavigationStateForUpdate({ reason });
  recordFrontendUpdateEvent({ type: 'pwa_skip_waiting', reason });

  try {
    const reg = lastRegistration || (await navigator.serviceWorker?.getRegistration?.());
    const waiting = reg?.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
      await new Promise((resolve) => {
        const onControllerChange = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
          resolve();
        };
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        window.setTimeout(resolve, 1500);
      });
    }
  } catch {
    /* still reload to pick up new HTML */
  }

  await hardReloadForStaleChunks(reason);
}

function notifyWaitingWorker(reason) {
  if (shouldDeferAppReload()) {
    requestUpdateUi('deferred', reason);
    return;
  }
  // Stage 2: never auto-reload on SW update — user confirms.
  requestUpdateUi('available', reason);
}

/**
 * Register SW (production) and surface waiting workers as update UX.
 * Does not implement offline product features.
 */
export function registerLonghuaServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }

  const scriptUrl = serviceWorkerScriptUrl();

  return navigator.serviceWorker
    .register(scriptUrl)
    .then((registration) => {
      lastRegistration = registration;

      if (registration.waiting && navigator.serviceWorker.controller) {
        notifyWaitingWorker('sw_already_waiting');
      }

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state !== 'installed') return;
          // First install (no controller yet) — quiet.
          if (!navigator.serviceWorker.controller) return;
          notifyWaitingWorker('sw_waiting');
        });
      });

      // Periodic check while tab stays open (deploy mid-session).
      const intervalId = window.setInterval(() => {
        registration.update().catch(() => {});
      }, 15 * 60 * 1000);

      window.addEventListener('beforeunload', () => {
        window.clearInterval(intervalId);
      });

      return registration;
    })
    .catch((err) => {
      recordFrontendUpdateEvent({
        type: 'sw_register_failed',
        reason: String(err?.message || err || 'register_failed'),
      });
      return null;
    });
}

export async function readServiceWorkerBuildId() {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) {
    return null;
  }
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(null), 800);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer);
      resolve(event.data?.buildId || null);
    };
    try {
      navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    } catch {
      window.clearTimeout(timer);
      resolve(null);
    }
  });
}
