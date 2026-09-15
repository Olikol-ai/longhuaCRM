/**
 * Shared materials upload limits and extension allowlist.
 * Used by Multer, SecureFilesService, and error messages.
 */
import { extname } from 'path';

/** Default 2 GiB — textbooks ~100–300 MB and video lessons need headroom. */
export const DEFAULT_MATERIALS_MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

export const MATERIALS_ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.pptx',
  '.ppt',
  '.docx',
  '.doc',
  '.xlsx',
  '.xls',
  '.mp4',
  '.webm',
  '.mov',
  '.3gp',
  '.mp3',
  '.wav',
  '.m4a',
  '.aac',
  '.ogg',
  '.opus',
  '.flac',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.zip',
]);

/** Browser/OS ZIP MIME variants (Android/Windows often send x-zip-compressed). */
export const MATERIALS_ZIP_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/zip-compressed',
  'multipart/x-zip',
]);

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.3gp': 'video/3gpp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.flac': 'audio/flac',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.zip': 'application/zip',
};

export type MaterialUploadFileKind =
  | 'pdf'
  | 'pptx'
  | 'video'
  | 'audio'
  | 'other';

export function getMaterialsMaxUploadBytes(): number {
  const raw = (process.env.MATERIALS_MAX_UPLOAD_BYTES || '').trim();
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_MATERIALS_MAX_UPLOAD_BYTES;
}

export function formatMaterialsMaxUploadLabel(bytes = getMaterialsMaxUploadBytes()): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    const gb = mb / 1024;
    const rounded = Number.isInteger(gb) ? String(gb) : gb.toFixed(1);
    return `${rounded} ГБ`;
  }
  return `${Math.round(mb)} МБ`;
}

export function guessMimeFromExtension(extension: string): string {
  return MIME_BY_EXT[extension.toLowerCase()] || 'application/octet-stream';
}

export function isZipMimeType(mimeType?: string | null): boolean {
  const mime = String(mimeType || '')
    .toLowerCase()
    .split(';')[0]
    .trim();
  return MATERIALS_ZIP_MIME_TYPES.has(mime);
}

/**
 * Resolve a safe allowlisted extension for an upload.
 * ZIP may arrive without a usable filename extension (mobile content pickers).
 */
export function resolveMaterialsUploadExtension(
  originalName: string,
  mimeType?: string | null,
): string {
  const extension = extname(originalName || '').toLowerCase();
  if (MATERIALS_ALLOWED_EXTENSIONS.has(extension)) {
    return extension;
  }
  // Non-empty unknown/disallowed extension must not be overridden by MIME
  // (prevents malware.exe + application/zip from being stored as .zip).
  if (extension) {
    return extension;
  }
  if (isZipMimeType(mimeType)) {
    return '.zip';
  }
  return extension;
}

export function isAllowedMaterialsUpload(
  originalName: string,
  mimeType?: string | null,
): boolean {
  return MATERIALS_ALLOWED_EXTENSIONS.has(
    resolveMaterialsUploadExtension(originalName, mimeType),
  );
}

/**
 * Multer historically decodes Content-Disposition filenames as latin1.
 * Recover UTF-8 (e.g. Cyrillic) when the classic mojibake pattern is present.
 */
export function decodeUploadOriginalName(originalName?: string | null): string {
  const raw = String(originalName || '').trim() || 'upload';
  if (!/[ÐÑÃ]/.test(raw)) {
    return raw;
  }
  try {
    const decoded = Buffer.from(raw, 'latin1').toString('utf8');
    if (decoded && !decoded.includes('\uFFFD')) {
      return decoded;
    }
  } catch {
    // keep raw
  }
  return raw;
}

export function detectMaterialFileKind(filename: string): MaterialUploadFileKind {
  const ext = filename.includes('.')
    ? `.${filename.split('.').pop()?.toLowerCase() || ''}`
    : '';
  if (ext === '.pdf') return 'pdf';
  if (ext === '.pptx' || ext === '.ppt') return 'pptx';
  if (['.mp4', '.webm', '.mov', '.3gp'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.flac'].includes(ext)) {
    return 'audio';
  }
  return 'other';
}
