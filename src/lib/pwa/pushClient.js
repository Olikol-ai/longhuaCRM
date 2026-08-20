import { apiFetch } from '@/api/http';
import { getServiceWorkerRegistration } from '@/lib/pwa/serviceWorkerClient';
import { shouldDeferAppReload } from '@/lib/pwa/reloadGate';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function fetchVapidPublicKey() {
  const data = await apiFetch('/notifications/vapid-public-key');
  return data?.publicKey || null;
}

export async function fetchWebPushStatus() {
  try {
    const data = await apiFetch('/notifications/vapid-public-key');
    const publicKey = data?.publicKey || null;
    return {
      publicKey,
      configured: Boolean(data?.configured && publicKey),
    };
  } catch {
    return { publicKey: null, configured: false };
  }
}

export async function getNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/**
 * Progressive opt-in — call only after user confirms in Settings.
 */
export async function enableWebPush({ deviceLabel = 'browser' } = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Уведомления не поддерживаются в этом браузере');
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Web Push недоступен');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Разрешение на уведомления не выдано');
  }

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) {
    throw new Error('VAPID public key не настроен на сервере');
  }

  const registration =
    getServiceWorkerRegistration()
    || (await navigator.serviceWorker.ready);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = subscription.toJSON();
  await apiFetch('/notifications/push-subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      },
      deviceLabel,
    }),
  });

  return subscription;
}

export async function syncPushSubscriptionIfGranted() {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return null;
    }
    return enableWebPush({ deviceLabel: 'auto-sync' });
  } catch {
    return null;
  }
}

/**
 * Logout of THIS device only — revoke current Push endpoint, leave other devices intact.
 * Must never hang: serviceWorker.ready / network can stall indefinitely.
 */
export async function revokeCurrentDevicePushSubscription({ timeoutMs = 2500 } = {}) {
  const { withTimeout } = await import('@/lib/asyncBounded');
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;

    const registration =
      getServiceWorkerRegistration()
      || (await withTimeout(
        navigator.serviceWorker.ready.catch(() => null),
        timeoutMs,
        null,
      ));
    if (!registration?.pushManager) return false;

    const subscription = await withTimeout(
      registration.pushManager.getSubscription(),
      timeoutMs,
      null,
    );
    if (!subscription?.endpoint) return false;

    const endpoint = subscription.endpoint;
    await withTimeout(
      apiFetch(
        `/notifications/push-subscriptions/by-endpoint?endpoint=${encodeURIComponent(endpoint)}`,
        { method: 'DELETE' },
      ).catch(() => null),
      timeoutMs,
      null,
    );
    await withTimeout(
      Promise.resolve(subscription.unsubscribe()).catch(() => false),
      timeoutMs,
      false,
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Soft navigate from SW notificationclick.
 * During an active video lesson / Document PiP gate: focus only — do not tear down the session.
 */
export function bindNotificationNavigate(navigate) {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return () => {};
  }
  const handler = (event) => {
    const data = event.data || {};
    if (data.type !== 'NOTIFICATION_NAVIGATE' || !data.url) return;
    if (shouldDeferAppReload()) {
      // Lesson / PiP active — keep VideoSession mounted; user must navigate explicitly.
      return;
    }
    if (typeof navigate === 'function') {
      navigate(data.url);
    }
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}
