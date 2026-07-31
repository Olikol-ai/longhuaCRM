import { mkdirSync } from 'fs';
import { join } from 'path';
import { getUploadsRoot, uploadsJoin } from '../../../common/storage/uploads-root';

/** Absolute directory for processed user avatars (never store originals). */
export const AVATAR_UPLOAD_DIR = uploadsJoin('avatars');

export const AVATAR_OPTIMIZED_SIZE = 512;
export const AVATAR_THUMB_SIZE = 128;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const AVATAR_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const AVATAR_ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export function avatarUserDir(userId: string): string {
  return join(getUploadsRoot(), 'avatars', userId);
}

export function avatarOptimizedRelativePath(userId: string): string {
  return join('avatars', userId, 'avatar.webp');
}

export function avatarThumbRelativePath(userId: string): string {
  return join('avatars', userId, 'thumb.webp');
}

export function avatarAbsoluteFromRelative(relativePath: string): string {
  return join(getUploadsRoot(), relativePath);
}

export function ensureAvatarUserDir(userId: string): string {
  const dir = avatarUserDir(userId);
  mkdirSync(dir, { recursive: true });
  return dir;
}
