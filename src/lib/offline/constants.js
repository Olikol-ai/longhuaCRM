/** Stage 3 — offline read constants (not SSOT). */

export const OFFLINE_DB_NAME = 'longhua-offline';

/** Bump when object-store shape changes. */
export const OFFLINE_DB_VERSION = 1;

/** Record payload schema (fields inside each stored value). */
export const OFFLINE_RECORD_SCHEMA = 1;

export const OFFLINE_STORES = Object.freeze([
  'metadata',
  'schedule',
  'chats',
  'materials',
  'homework',
  'profile',
  'balance',
]);

export const OFFLINE_RESOURCES = Object.freeze({
  SCHEDULE: 'schedule',
  CHATS_LIST: 'chats_list',
  CHAT_MESSAGES: 'chat_messages',
  MATERIALS: 'materials',
  HOMEWORK: 'homework',
  PROFILE: 'profile',
  BALANCE: 'balance',
});

/** Map resource → object store name. */
export const RESOURCE_STORE = Object.freeze({
  [OFFLINE_RESOURCES.SCHEDULE]: 'schedule',
  [OFFLINE_RESOURCES.CHATS_LIST]: 'chats',
  [OFFLINE_RESOURCES.CHAT_MESSAGES]: 'chats',
  [OFFLINE_RESOURCES.MATERIALS]: 'materials',
  [OFFLINE_RESOURCES.HOMEWORK]: 'homework',
  [OFFLINE_RESOURCES.PROFILE]: 'profile',
  [OFFLINE_RESOURCES.BALANCE]: 'balance',
});

/** Default TTL: 7 days (still shown with stale warning after STALE_WARN_MS). */
export const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** UI warns that data may be outdated after this age. */
export const STALE_WARN_MS = 60 * 60 * 1000;

/** Max messages kept per conversation offline. */
export const CHAT_MESSAGE_CAP = 100;

export const OFFLINE_MUTATION_MESSAGE =
  'Для этого действия требуется подключение к интернету.';

export const OFFLINE_OPEN_FILE_MESSAGE =
  'Для открытия материала требуется подключение к интернету.';
