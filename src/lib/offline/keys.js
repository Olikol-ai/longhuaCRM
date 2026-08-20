import { OFFLINE_RECORD_SCHEMA, RESOURCE_STORE } from './constants.js';

/**
 * Build a scoped primary key. Never use bare resource names without userId+role.
 * @param {string} userId
 * @param {string} role
 * @param {string} resource
 * @param {string} [resourceKey='default']
 */
export function buildOfflineKey(userId, role, resource, resourceKey = 'default') {
  const uid = String(userId || '').trim();
  const r = String(role || '').trim() || 'unknown';
  const res = String(resource || '').trim();
  const rk = String(resourceKey || 'default').trim() || 'default';
  if (!uid) throw new Error('offline key requires userId');
  if (!res) throw new Error('offline key requires resource');
  return `${uid}::${r}::${res}::${rk}`;
}

export function storeNameForResource(resource) {
  const store = RESOURCE_STORE[resource];
  if (!store) throw new Error(`Unknown offline resource: ${resource}`);
  return store;
}

/**
 * @param {object} input
 */
export function createSnapshotRecord({
  userId,
  role,
  resource,
  resourceKey = 'default',
  data,
  source = 'api',
  updatedAt = Date.now(),
  expiresAt = null,
  schemaVersion = OFFLINE_RECORD_SCHEMA,
}) {
  const key = buildOfflineKey(userId, role, resource, resourceKey);
  return {
    key,
    userId: String(userId),
    role: String(role || 'unknown'),
    resource: String(resource),
    resourceKey: String(resourceKey || 'default'),
    data,
    source: String(source || 'api'),
    updatedAt: Number(updatedAt) || Date.now(),
    expiresAt: expiresAt == null ? null : Number(expiresAt),
    schemaVersion: Number(schemaVersion) || OFFLINE_RECORD_SCHEMA,
  };
}

export function isSnapshotExpired(record, now = Date.now()) {
  if (!record) return true;
  if (record.expiresAt == null) return false;
  return Number(record.expiresAt) <= now;
}

export function parseOfflineKey(key) {
  const parts = String(key || '').split('::');
  if (parts.length < 4) return null;
  const [userId, role, resource, ...rest] = parts;
  return {
    userId,
    role,
    resource,
    resourceKey: rest.join('::') || 'default',
  };
}
