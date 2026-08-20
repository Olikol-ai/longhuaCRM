import { DEFAULT_TTL_MS, OFFLINE_STORES } from './constants.js';
import { getOfflineBackend } from './offlineDb.js';
import {
  buildOfflineKey,
  createSnapshotRecord,
  isSnapshotExpired,
  storeNameForResource,
} from './keys.js';
import { sanitizeForOffline } from './sanitize.js';

/**
 * Persist a read snapshot for one user+role+resource.
 */
export async function putSnapshot({
  userId,
  role,
  resource,
  resourceKey = 'default',
  data,
  source = 'api',
  ttlMs = DEFAULT_TTL_MS,
}) {
  const cleaned = sanitizeForOffline(data);
  const updatedAt = Date.now();
  const expiresAt = ttlMs == null ? null : updatedAt + Number(ttlMs);
  const record = createSnapshotRecord({
    userId,
    role,
    resource,
    resourceKey,
    data: cleaned,
    source,
    updatedAt,
    expiresAt,
  });
  const backend = await getOfflineBackend();
  const store = backend.store(storeNameForResource(resource));
  await store.put(record);
  return record;
}

/**
 * @returns {Promise<object|null>}
 */
export async function getSnapshot({
  userId,
  role,
  resource,
  resourceKey = 'default',
  allowExpired = false,
  now = Date.now(),
}) {
  const backend = await getOfflineBackend();
  const store = backend.store(storeNameForResource(resource));
  const key = buildOfflineKey(userId, role, resource, resourceKey);
  const record = await store.get(key);
  if (!record) return null;
  if (!allowExpired && isSnapshotExpired(record, now)) {
    await store.delete(key);
    return null;
  }
  // Hard isolation: never return another user's row even if key collision somehow.
  if (String(record.userId) !== String(userId) || String(record.role) !== String(role || 'unknown')) {
    return null;
  }
  return record;
}

export async function deleteSnapshot({ userId, role, resource, resourceKey = 'default' }) {
  const backend = await getOfflineBackend();
  const store = backend.store(storeNameForResource(resource));
  await store.delete(buildOfflineKey(userId, role, resource, resourceKey));
}

/**
 * Delete all private offline rows for one user (all roles on that account).
 */
export async function clearOfflineDataForUser(userId) {
  const uid = String(userId || '').trim();
  if (!uid) return;
  const backend = await getOfflineBackend();
  await Promise.all(
    OFFLINE_STORES.map(async (name) => {
      const store = backend.store(name);
      const all = await store.getAll();
      await Promise.all(
        all
          .filter((row) => row && String(row.userId) === uid)
          .map((row) => store.delete(row.key)),
      );
    }),
  );
}

/** Wipe entire offline DB (logout / account switch). */
export async function clearAllOfflineData() {
  const backend = await getOfflineBackend();
  await Promise.all(OFFLINE_STORES.map((name) => backend.store(name).clear()));
}

const META_SCOPE_KEY = 'meta::last_scope';

export async function readLastOfflineScope() {
  const backend = await getOfflineBackend();
  const row = await backend.store('metadata').get(META_SCOPE_KEY);
  return row?.data || null;
}

export async function writeLastOfflineScope(userId, role) {
  const backend = await getOfflineBackend();
  await backend.store('metadata').put({
    key: META_SCOPE_KEY,
    userId: String(userId || ''),
    role: String(role || ''),
    resource: 'metadata',
    resourceKey: 'last_scope',
    data: { userId: String(userId || ''), role: String(role || '') },
    source: 'app',
    updatedAt: Date.now(),
    expiresAt: null,
    schemaVersion: 1,
  });
}

/**
 * Ensure offline cache belongs to current account.
 * On user change → clear all private data.
 */
export async function ensureOfflineUserScope(userId, role) {
  const uid = String(userId || '').trim();
  if (!uid) return;
  const last = await readLastOfflineScope();
  if (last?.userId && last.userId !== uid) {
    await clearAllOfflineData();
  }
  await writeLastOfflineScope(uid, role);
}
