import { existsSync } from 'fs';
import { basename, join, normalize, resolve } from 'path';

/**
 * Single uploads root for materials, chat, avatars, assessment.
 * Prefer UPLOADS_DIR env; otherwise resolve a stable absolute path that
 * works whether the API process cwd is repo root or apps/api.
 */
let cachedRoot: string | null = null;

function candidateRoots(): string[] {
  const fromEnv = (process.env.UPLOADS_DIR || process.env.UPLOADS_ROOT || '').trim();
  const list: string[] = [];
  if (fromEnv) list.push(resolve(fromEnv));
  // Common layouts: nest cwd = apps/api, or monorepo root.
  list.push(resolve(process.cwd(), 'uploads'));
  list.push(resolve(process.cwd(), 'apps', 'api', 'uploads'));
  list.push(resolve(process.cwd(), '..', 'uploads'));
  list.push(resolve(process.cwd(), '..', '..', 'uploads'));
  return [...new Set(list)];
}

export function getUploadsRoot(): string {
  if (cachedRoot) return cachedRoot;
  const candidates = candidateRoots();
  const existing = candidates.find((dir) => existsSync(dir));
  cachedRoot = existing || candidates[0];
  return cachedRoot;
}

/** Absolute path under uploads root (creates logical path only — caller mkdirs). */
export function uploadsJoin(...parts: string[]): string {
  return join(getUploadsRoot(), ...parts);
}

/**
 * Resolve a stored key like `/uploads/file.pdf`, `uploads/chat/x`, or bare filename
 * to an absolute path under the uploads root. Rejects path traversal.
 */
export function resolveUploadPath(storageKey: string): string {
  const raw = String(storageKey || '')
    .trim()
    .replace(/^\/uploads\//, '')
    .replace(/^uploads\//, '');
  if (!raw) {
    throw new Error('INVALID_UPLOAD_PATH');
  }
  const root = normalize(getUploadsRoot());
  const absolute = normalize(join(root, raw));
  if (!absolute.startsWith(root)) {
    throw new Error('INVALID_UPLOAD_PATH');
  }
  return absolute;
}

/**
 * Find an existing file for a storage key, trying the unified root and legacy
 * basename-only locations (older materials stored flat).
 */
export function findExistingUpload(storageKey: string): string | null {
  try {
    const primary = resolveUploadPath(storageKey);
    if (existsSync(primary)) return primary;
  } catch {
    // continue
  }

  const name = basename(
    String(storageKey || '')
      .replace(/^\/uploads\//, '')
      .replace(/^uploads\//, ''),
  );
  if (!name || name === '.' || name.includes('..')) return null;

  for (const root of candidateRoots()) {
    const candidate = join(root, name);
    if (existsSync(candidate)) return candidate;
    const chatCandidate = join(root, 'chat', name);
    if (existsSync(chatCandidate)) return chatCandidate;
  }
  return null;
}

/** Reset cache (tests). */
export function resetUploadsRootCache(): void {
  cachedRoot = null;
}
