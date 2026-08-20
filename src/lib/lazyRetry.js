/**
 * React.lazy wrapper — chunk failures are handled by AppErrorBoundary + FrontendUpdateScreen.
 * Recovery helpers live in `@/lib/frontendUpdate`.
 */
export {
  CHUNK_RELOAD_STORAGE_KEY,
  claimChunkAutoReload,
  claimChunkAutoReloadUnlessVideo,
  clearClientModuleCaches,
  extractChunkUrl,
  finalizeFrontendUpdateRecovery,
  getFrontendBuildId,
  hardReloadForStaleChunks,
  isChunkLoadError,
  lazyRetry,
  logChunkLoadError,
  markChunkLoadError,
  recordFrontendUpdateEvent,
  saveNavigationStateForUpdate,
} from './frontendUpdate.js';
