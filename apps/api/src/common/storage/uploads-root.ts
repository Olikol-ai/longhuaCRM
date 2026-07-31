import { existsSync, mkdirSync } from 'fs';
import { basename, join, normalize, resolve } from 'path';

/**
 * Single uploads root for materials, chat, avatars, assessment.
 * Prefer UPLOADS_DIR / UPLOADS_ROOT env (absolute). Fallback candidates only
 * when env is unset — never silently pick a second root after the first write.
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

/**
 * Pin the uploads root once. If UPLOADS_DIR is set, it always wins (created if missing).
 * Otherwise the first existing candidate is used; if none exist, cwd/uploads is created.
 */
export function getUploadsRoot(): string {
  if (cachedRoot) return cachedRoot;

  const fromEnv = (process.env.UPLOADS_DIR || process.env.UPLOADS_ROOT || '').trim();
  if (fromEnv) {
    const absolute = resolve(fromEnv);
    mkdirSync(absolute, { recursive: true });
    cachedRoot = absolute;
    return cachedRoot;
  }

  const candidates = candidateRoots();
  const existing = candidates.find((dir) => existsSync(dir));
  if (existing) {
    cachedRoot = existing;
    return cachedRoot;
  }

  const fallback = candidates[0] || resolve(process.cwd(), 'uploads');
  mkdirSync(fallback, { recursive: true });
  cachedRoot = fallback;
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
 * Find an existing file for a storage key, trying the unified root and legacy
 * basename-only locations (older materials stored flat under alternate roots).
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

/** List other upload directories that exist besides the pinned root (split-brain risk). */
export function listAlternateUploadRoots(): string[] {
  const primary = normalize(getUploadsRoot());
  return candidateRoots().filter(
    (dir) => existsSync(dir) && normalize(dir) !== primary,
  );
}

/** Reset cache (tests). */
export function resetUploadsRootCache(): void {
  cachedRoot = null;
}
