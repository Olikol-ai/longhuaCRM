import { existsSync, mkdirSync } from 'fs';
import { basename, join, normalize, resolve } from 'path';
import { STORAGE_NAMESPACES, StorageNamespace } from './storage.constants';

/**
 * Permanent file root for LonghuaCRM.
 *
 * MUST be an absolute path via UPLOADS_DIR / UPLOADS_ROOT
 * (e.g. /mnt/storage/longhua-storage). Never derive the root from the process working directory.
 */
let cachedRoot: string | null = null;

export class UploadsRootNotConfiguredError extends Error {
  constructor() {
    super(
      'UPLOADS_DIR is not set to an absolute path. ' +
        'Set UPLOADS_DIR=/mnt/storage/longhua-storage (or your permanent HDD root).',
    );
    this.name = 'UploadsRootNotConfiguredError';
  }
}

function readConfiguredRoot(): string {
  const fromEnv = (process.env.UPLOADS_DIR || process.env.UPLOADS_ROOT || '').trim();
  if (!fromEnv) {
    throw new UploadsRootNotConfiguredError();
  }
  if (!fromEnv.startsWith('/')) {
    throw new Error(`UPLOADS_DIR must be an absolute path, got: ${fromEnv}`);
  }
  return resolve(fromEnv);
}

/** Ensure namespace folders exist under the pinned root. */
export function ensureStorageLayout(root: string = getUploadsRoot()): void {
  mkdirSync(root, { recursive: true });
  for (const ns of STORAGE_NAMESPACES) {
    mkdirSync(join(root, ns), { recursive: true });
  }
}

/**
 * Pin and return the permanent uploads root.
 * Creates the directory + namespace layout on first use.
 */
export function getUploadsRoot(): string {
  if (cachedRoot) return cachedRoot;
  const absolute = readConfiguredRoot();
  ensureStorageLayout(absolute);
  cachedRoot = absolute;
  return cachedRoot;
}

export function uploadsJoin(...parts: string[]): string {
  return join(getUploadsRoot(), ...parts);
}

export function namespaceDir(namespace: StorageNamespace): string {
  const dir = uploadsJoin(namespace);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Normalize a DB storage key to a relative path under the uploads root
 * (no leading /uploads/).
 */
export function normalizeStorageKey(storageKey: string): string {
  return String(storageKey || '')
    .trim()
    .replace(/^\/uploads\//, '')
    .replace(/^uploads\//, '')
    .replace(/^\/+/, '');
}

/**
 * Resolve a stored key to an absolute path under the uploads root.
 * Rejects path traversal.
 */
export function resolveUploadPath(storageKey: string): string {
  const raw = normalizeStorageKey(storageKey);
  if (!raw || raw.includes('..')) {
    throw new Error('INVALID_UPLOAD_PATH');
  }
  const root = normalize(getUploadsRoot());
  const absolute = normalize(join(root, raw));
  const prefix = root.endsWith('/') ? root : `${root}/`;
  if (absolute !== root && !absolute.startsWith(prefix)) {
    throw new Error('INVALID_UPLOAD_PATH');
  }
  return absolute;
}

/**
 * Find an existing file for a storage key.
 * Tries the primary path, then legacy flat / namespace locations.
 */
export function findExistingUpload(storageKey: string): string | null {
  try {
    const primary = resolveUploadPath(storageKey);
    if (existsSync(primary)) return primary;
  } catch {
    // continue
  }

  const raw = normalizeStorageKey(storageKey);
  const name = basename(raw);
  if (!name || name === '.' || name.includes('..')) return null;

  const root = getUploadsRoot();
  const candidates = [
    join(root, name),
    join(root, 'materials', name),
    join(root, 'chat', name),
    join(root, 'voice', name),
    join(root, 'speaking', name),
    join(root, 'assessment', name),
    join(root, 'homework', name),
    join(root, 'temp', name),
  ];

  // If key already includes a namespace prefix, also try as-is under root (done above).
  if (raw.includes('/')) {
    candidates.unshift(join(root, raw));
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Public URL/key prefix stored in DB for browser-facing paths. */
export function toPublicStorageKey(relativePath: string): string {
  const cleaned = normalizeStorageKey(relativePath);
  return `/uploads/${cleaned}`;
}

/** Reset cache (tests). */
export function resetUploadsRootCache(): void {
  cachedRoot = null;
}
