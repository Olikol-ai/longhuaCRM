export {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_RECORD_SCHEMA,
  OFFLINE_STORES,
  OFFLINE_RESOURCES,
  RESOURCE_STORE,
  DEFAULT_TTL_MS,
  STALE_WARN_MS,
  CHAT_MESSAGE_CAP,
  OFFLINE_MUTATION_MESSAGE,
  OFFLINE_OPEN_FILE_MESSAGE,
} from './constants.js';

export {
  buildOfflineKey,
  storeNameForResource,
  createSnapshotRecord,
  isSnapshotExpired,
  parseOfflineKey,
} from './keys.js';

export {
  sanitizeForOffline,
  sanitizeMaterialMetaList,
  sanitizeChatMessages,
  stripAuthFromUrl,
} from './sanitize.js';

export {
  getOfflineBackend,
  setOfflineBackend,
  createMemoryOfflineBackend,
  resetOfflineDbConnection,
} from './offlineDb.js';

export {
  putSnapshot,
  getSnapshot,
  deleteSnapshot,
  clearOfflineDataForUser,
  clearAllOfflineData,
  ensureOfflineUserScope,
  readLastOfflineScope,
  writeLastOfflineScope,
} from './offlineRepository.js';

export {
  getOfflineNetworkState,
  getOfflineMode,
  isOfflineMode,
  subscribeOfflineNetwork,
  markNetworkOnline,
  markNetworkOffline,
  markNetworkDegraded,
  markNetworkRecovering,
  consumeRecoveredToast,
  isLikelyNetworkError,
  bindOfflineNetworkListeners,
  resetOfflineNetworkStateForTests,
} from './offlineStatus.js';

export {
  OfflineMutationError,
  assertOnlineForMutation,
  isMutationMethod,
  noteFetchFailure,
} from './offlineGuard.js';

export {
  formatOfflineUpdatedAt,
  isOfflineDataStale,
  offlineStaleCaption,
} from './formatUpdatedAt.js';

export { readWithOfflineFallback } from './offlineSync.js';
