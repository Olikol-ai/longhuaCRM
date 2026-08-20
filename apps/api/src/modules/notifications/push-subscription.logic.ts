/**
 * Pure helpers for push subscription lifecycle (unit-testable, no Nest).
 */

export function shouldRevokePushStatus(statusCode: number | null | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

export function shouldRetryPushStatus(statusCode: number | null | undefined): boolean {
  if (!statusCode) return true;
  if (statusCode === 404 || statusCode === 410) return false;
  if (statusCode >= 500) return true;
  if (statusCode === 429) return true;
  return false;
}

export interface PushSubRow {
  id: string;
  endpoint: string;
}

/**
 * Logout must revoke only the current device endpoint, never all user devices.
 */
export function selectSubscriptionsToRevokeOnLogout(
  activeRows: PushSubRow[] | null | undefined,
  currentEndpoint: string | null | undefined,
): PushSubRow[] {
  const endpoint = String(currentEndpoint || '').trim();
  if (!endpoint) return [];
  return (activeRows || []).filter((row) => String(row.endpoint) === endpoint);
}

export interface SubscriptionUpsertInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userId: string;
  userAgent?: string | null;
  deviceLabel?: string | null;
}

export interface ExistingSubscriptionFields {
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  userId?: string;
  userAgent?: string | null;
  deviceLabel?: string | null;
  revokedAt?: Date | string | null;
}

export interface MergedSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  userId: string;
  userAgent: string | null;
  deviceLabel: string | null;
  revokedAt: null;
  isNew: boolean;
}

/**
 * Upsert semantics: same endpoint → one row (rebind user); different endpoints → multi-device.
 */
export function mergeSubscriptionUpsert(
  existing: ExistingSubscriptionFields | null | undefined,
  input: SubscriptionUpsertInput,
): MergedSubscription {
  if (!existing) {
    return {
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userId: input.userId,
      userAgent: input.userAgent || null,
      deviceLabel: input.deviceLabel || null,
      revokedAt: null,
      isNew: true,
    };
  }
  return {
    endpoint: String(existing.endpoint || input.endpoint),
    userId: input.userId,
    p256dh: input.p256dh,
    auth: input.auth,
    userAgent: input.userAgent || existing.userAgent || null,
    deviceLabel: input.deviceLabel || existing.deviceLabel || null,
    revokedAt: null,
    isNew: false,
  };
}

export interface SafePushPayloadInput {
  notificationId?: string;
  eventId?: string | null;
  type?: string;
  title?: string;
  body?: string;
  deepLink?: string | null;
  timestamp?: number;
}

/** Safe push JSON — never include secrets. */
export function buildSafePushPayload(input: SafePushPayloadInput) {
  return {
    notificationId: String(input.notificationId || ''),
    eventId: input.eventId ? String(input.eventId) : null,
    type: String(input.type || 'system.announcement'),
    title: String(input.title || 'Longhua CRM').slice(0, 120),
    body: String(input.body || '').slice(0, 240),
    deepLink: input.deepLink ? String(input.deepLink).slice(0, 512) : '/',
    timestamp: Number(input.timestamp) || Date.now(),
  };
}

export function assertNoSecretsInPushPayload(payload: unknown): true {
  const raw = JSON.stringify(payload || {});
  const forbidden = [
    'Bearer ',
    'access_token',
    'VAPID_PRIVATE',
    'vapidPrivate',
    'privateKey',
    'Authorization',
    'password',
  ];
  for (const token of forbidden) {
    if (raw.includes(token)) {
      throw new Error(`Forbidden secret marker in push payload: ${token}`);
    }
  }
  return true;
}
