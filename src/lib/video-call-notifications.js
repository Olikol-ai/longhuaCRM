/**
 * Lesson video-call notification core (teacher-facing).
 * Pure helpers — no React. Used by LessonVideoNotificationLayer.
 *
 * Event kinds: hand | chat | ping | system
 */

export const VIDEO_NOTIF_KINDS = Object.freeze({
  HAND: 'hand',
  CHAT: 'chat',
  PING: 'ping',
  SYSTEM: 'system',
});

const DEDUPE_TTL_MS = 30 * 60_000;
const PING_THROTTLE_MS = 30_000;
const TOAST_MAX = 4;
const TOAST_TTL_MS = 12_000;

/** @type {Map<string, number>} */
const seenKeys = new Map();

export function clearVideoNotifDedupe() {
  seenKeys.clear();
}

function pruneDedupe(now = Date.now()) {
  for (const [key, at] of seenKeys) {
    if (now - at > DEDUPE_TTL_MS) seenKeys.delete(key);
  }
}

/**
 * Returns true if this key is new (should notify); false if duplicate.
 * @param {string} key
 * @param {number} [now]
 */
export function claimVideoNotifKey(key, now = Date.now()) {
  if (!key) return false;
  pruneDedupe(now);
  if (seenKeys.has(key)) return false;
  seenKeys.set(key, now);
  return true;
}

/** Allow the same logical key again (e.g. hand lowered → raised). */
export function releaseVideoNotifKey(key) {
  if (key) seenKeys.delete(key);
}

export function handRaiseDedupeKey(lessonId, identity) {
  return `hand_raised:${lessonId || 'x'}:${identity || 'unknown'}`;
}

export function chatMessageDedupeKey(lessonId, messageId) {
  return `chat:${lessonId || 'x'}:${messageId || 'unknown'}`;
}

export function pingDedupeKey(lessonId, fromId, bucketMs = PING_THROTTLE_MS) {
  const bucket = Math.floor(Date.now() / bucketMs);
  return `ping:${lessonId || 'x'}:${fromId || 'unknown'}:${bucket}`;
}

/**
 * @param {object} input
 * @returns {object|null}
 */
export function buildVideoNotifEvent(input = {}) {
  const kind = input.kind;
  if (!kind || !Object.values(VIDEO_NOTIF_KINDS).includes(kind)) return null;
  const id =
    input.id ||
    `${kind}:${input.lessonId || 'x'}:${input.actorId || 'a'}:${input.at || Date.now()}`;
  const title = String(input.title || '').trim() || defaultTitle(kind);
  const body = String(input.body || '').trim() || defaultBody(kind);
  return {
    id,
    kind,
    title,
    body,
    actorName: input.actorName || null,
    actorId: input.actorId || null,
    participantId: input.participantId || null,
    lessonId: input.lessonId || null,
    messageId: input.messageId || null,
    action: input.action || defaultAction(kind),
    actionHint: input.actionHint || 'Нажмите, чтобы посмотреть',
    createdAt: input.at || Date.now(),
    read: false,
    dedupeKey: input.dedupeKey || id,
  };
}

function defaultTitle(kind) {
  if (kind === VIDEO_NOTIF_KINDS.HAND) return 'Поднята рука';
  if (kind === VIDEO_NOTIF_KINDS.CHAT) return 'Новое сообщение';
  if (kind === VIDEO_NOTIF_KINDS.PING) return 'Запрос внимания';
  return 'Событие урока';
}

function defaultBody(kind) {
  if (kind === VIDEO_NOTIF_KINDS.HAND) return 'Ученик поднял руку';
  if (kind === VIDEO_NOTIF_KINDS.CHAT) return 'Новое сообщение в чате урока';
  if (kind === VIDEO_NOTIF_KINDS.PING) return 'Ученик просит внимания';
  return 'Важное событие урока';
}

function defaultAction(kind) {
  if (kind === VIDEO_NOTIF_KINDS.HAND) return 'open_participants';
  if (kind === VIDEO_NOTIF_KINDS.CHAT) return 'open_chat';
  if (kind === VIDEO_NOTIF_KINDS.PING) return 'open_participants';
  return 'open_center';
}

export function kindIconLabel(kind) {
  if (kind === VIDEO_NOTIF_KINDS.HAND) return '✋';
  if (kind === VIDEO_NOTIF_KINDS.CHAT) return '💬';
  if (kind === VIDEO_NOTIF_KINDS.PING) return '🔔';
  return '⚠️';
}

/**
 * Whether to fire an OS/PWA notification (in addition to in-app).
 * @param {{ documentHidden?: boolean, documentFocused?: boolean, screenSharing?: boolean, viewingTarget?: boolean }} ctx
 */
export function shouldShowOsNotification(ctx = {}) {
  if (ctx.viewingTarget) return false;
  if (ctx.screenSharing) return true;
  if (ctx.documentHidden) return true;
  if (ctx.documentFocused === false) return true;
  return false;
}

/**
 * @param {{ permission?: string, documentHidden?: boolean, documentFocused?: boolean, screenSharing?: boolean, viewingTarget?: boolean }} ctx
 */
export function resolveVideoNotifChannels(ctx = {}) {
  const permission = ctx.permission || 'default';
  const channels = {
    toast: true,
    center: true,
    os: false,
  };
  if (permission === 'granted' && shouldShowOsNotification(ctx)) {
    channels.os = true;
  }
  return channels;
}

/**
 * Push into toast stack (newest first), cap length.
 * @param {object[]} stack
 * @param {object} event
 */
export function pushToastStack(stack, event, max = TOAST_MAX) {
  const next = [event, ...(stack || []).filter((row) => row.id !== event.id)];
  return next.slice(0, max);
}

export function dismissToastFromStack(stack, id) {
  return (stack || []).filter((row) => row.id !== id);
}

/**
 * Merge into unread center list (newest first).
 */
export function pushCenterList(list, event, max = 40) {
  const without = (list || []).filter(
    (row) => row.id !== event.id && row.dedupeKey !== event.dedupeKey,
  );
  return [event, ...without].slice(0, max);
}

export function markCenterRead(list, id) {
  return (list || []).map((row) =>
    row.id === id || (!id && !row.read) ? { ...row, read: true } : row,
  );
}

export function markAllCenterRead(list) {
  return (list || []).map((row) => ({ ...row, read: true }));
}

export function unreadCenterCount(list) {
  return (list || []).filter((row) => !row.read).length;
}

export const VIDEO_NOTIF_TOAST_TTL_MS = TOAST_TTL_MS;
export const VIDEO_NOTIF_PING_THROTTLE_MS = PING_THROTTLE_MS;

/** Jitsi endpoint-text payload for attention ping. */
export const VIDEO_PING_MESSAGE_TYPE = 'lh.attention';

export function encodeVideoPingPayload({ displayName, crmUserId } = {}) {
  return JSON.stringify({
    type: VIDEO_PING_MESSAGE_TYPE,
    v: 1,
    at: Date.now(),
    name: displayName || null,
    crmUserId: crmUserId || null,
  });
}

export function parseVideoPingPayload(raw) {
  try {
    const text = typeof raw === 'string' ? raw : raw?.text || raw?.data || '';
    const parsed = JSON.parse(String(text));
    if (parsed?.type !== VIDEO_PING_MESSAGE_TYPE) return null;
    return parsed;
  } catch {
    return null;
  }
}

const PERMISSION_PROMPT_KEY = 'lh-video-notif-permission-prompt';

export function wasVideoNotifPromptDismissed() {
  try {
    return window.localStorage.getItem(PERMISSION_PROMPT_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissVideoNotifPrompt() {
  try {
    window.localStorage.setItem(PERMISSION_PROMPT_KEY, '1');
  } catch {
    // ignore
  }
}

/**
 * Show OS notification via page Notification API, falling back to SW when available.
 * Deduped by tag.
 */
export async function showVideoOsNotification(event, { onClick } = {}) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false;
  }
  if (Notification.permission !== 'granted') return false;

  const title = `${kindIconLabel(event.kind)} ${event.title}`.trim();
  const options = {
    body: event.body,
    tag: event.dedupeKey || event.id,
    renotify: false,
    requireInteraction: false,
    silent: false,
    data: {
      lessonId: event.lessonId,
      action: event.action,
      eventId: event.id,
      kind: event.kind,
    },
  };

  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.showNotification) {
      await reg.showNotification(title, options);
      return true;
    }
  } catch {
    // fall through to page Notification
  }

  try {
    const n = new Notification(title, options);
    if (onClick) {
      n.onclick = (e) => {
        e.preventDefault();
        try {
          window.focus();
        } catch {
          // ignore
        }
        onClick(event);
        n.close();
      };
    }
    return true;
  } catch {
    return false;
  }
}

export async function ensureVideoNotifPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}
