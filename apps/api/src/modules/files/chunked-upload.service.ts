/**
 * Sessioned chunked material uploads (Cloudflare edge body limit ~100 MB).
 * Chunks land on disk under getUploadTempRoot(); complete() concatenates then
 * StorageService.saveFromPath moves into permanent materials storage.
 *
 * Temp root prefers UPLOADS_DIR/temp/material-uploads (same disk as permanent
 * storage) so rename is atomic and we avoid 2× cross-device copies via /tmp.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import {
  decodeUploadOriginalName,
  formatMaterialsMaxUploadLabel,
  getMaterialsMaxUploadBytes,
  isAllowedMaterialsUpload,
  MATERIALS_UPLOAD_CHUNK_BYTES,
  MATERIALS_UPLOAD_MAX_CHUNKS,
  resolveMaterialsUploadExtension,
} from './material-upload.limits';
import { MaterialUploadResult, SecureFilesService } from './secure-files.service';
import { UploadedFilePayload } from './uploaded-file.types';
import { getUploadsRoot } from '../../common/storage/uploads-root';

/** Re-export for controllers / tests (single source: material-upload.limits). */
export { MATERIALS_UPLOAD_CHUNK_BYTES, MATERIALS_UPLOAD_MAX_CHUNKS };

/** Long enough for multi-GB uploads on slow links (chunked only). */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

let resolvedTempRoot: string | null = null;

/**
 * Prefer permanent storage disk for temp uploads so rename() stays same-FS.
 * Falls back to OS tmpdir when UPLOADS_DIR is not configured (unit tests).
 */
export function getUploadTempRoot(): string {
  if (resolvedTempRoot) {
    return resolvedTempRoot;
  }
  try {
    const root = join(getUploadsRoot(), 'temp', 'material-uploads');
    mkdirSync(root, { recursive: true });
    resolvedTempRoot = root;
    return resolvedTempRoot;
  } catch {
    const fallback = join(tmpdir(), 'longhua-material-uploads');
    mkdirSync(fallback, { recursive: true });
    resolvedTempRoot = fallback;
    return resolvedTempRoot;
  }
}

/** Test-only: clear cached temp root so UPLOADS_DIR can be re-resolved. */
export function resetUploadTempRootForTests(): void {
  resolvedTempRoot = null;
}

/** @deprecated use getUploadTempRoot() — kept for callers that import the old name. */
export const UPLOAD_TEMP_ROOT = join(tmpdir(), 'longhua-material-uploads');

type ChunkSessionMeta = {
  uploadId: string;
  userId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  totalChunks: number;
  chunkSizeBytes: number;
  received: boolean[];
  createdAt: number;
  expiresAt: number;
};

@Injectable()
export class ChunkedUploadService implements OnModuleDestroy {
  private readonly logger = new Logger(ChunkedUploadService.name);
  private readonly memory = new Map<string, ChunkSessionMeta>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(private readonly secureFiles: SecureFilesService) {
    mkdirSync(getUploadTempRoot(), { recursive: true });
    this.cleanupTimer = setInterval(() => this.purgeExpired(), 15 * 60 * 1000);
    this.cleanupTimer.unref?.();
    this.logger.log(`ChunkedUploadService tempRoot=${getUploadTempRoot()}`);
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  getTempRoot(): string {
    return getUploadTempRoot();
  }

  initSession(input: {
    userId: string;
    originalName: string;
    mimeType?: string | null;
    sizeBytes: number;
  }): { uploadId: string; chunkSizeBytes: number; totalChunks: number } {
    const maxBytes = getMaterialsMaxUploadBytes();
    const sizeBytes = Number(input.sizeBytes) || 0;
    if (!sizeBytes || sizeBytes < 1) {
      throw new BadRequestException('File is required');
    }
    if (sizeBytes > maxBytes) {
      throw new BadRequestException(
        `Размер файла не должен превышать ${formatMaterialsMaxUploadLabel(maxBytes)}`,
      );
    }

    const originalName = decodeUploadOriginalName(input.originalName);
    if (!isAllowedMaterialsUpload(originalName, input.mimeType)) {
      throw new BadRequestException('File type is not allowed');
    }

    const chunkSizeBytes = MATERIALS_UPLOAD_CHUNK_BYTES;
    const totalChunks = Math.ceil(sizeBytes / chunkSizeBytes);
    if (totalChunks < 1 || totalChunks > MATERIALS_UPLOAD_MAX_CHUNKS) {
      throw new BadRequestException('Invalid upload size');
    }

    const uploadId = randomUUID();
    const now = Date.now();
    const meta: ChunkSessionMeta = {
      uploadId,
      userId: input.userId,
      originalName,
      mimeType: String(input.mimeType || '').trim() || 'application/octet-stream',
      sizeBytes,
      totalChunks,
      chunkSizeBytes,
      received: Array.from({ length: totalChunks }, () => false),
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    };

    mkdirSync(this.sessionDir(uploadId), { recursive: true });
    this.writeMeta(meta);
    this.memory.set(uploadId, meta);

    this.logger.log(
      `chunked.init uploadId=${uploadId} userId=${input.userId} ` +
        `sizeBytes=${sizeBytes} totalChunks=${totalChunks} chunkSize=${chunkSizeBytes}`,
    );

    return { uploadId, chunkSizeBytes, totalChunks };
  }

  saveChunk(input: {
    userId: string;
    uploadId: string;
    chunkIndex: number;
    file: UploadedFilePayload;
  }): { receivedChunks: number; totalChunks: number } {
    const meta = this.requireSession(input.uploadId, input.userId);
    const index = Number(input.chunkIndex);
    if (!Number.isInteger(index) || index < 0 || index >= meta.totalChunks) {
      this.cleanupTempFile(input.file);
      throw new BadRequestException('Invalid chunk index');
    }
    if (!input.file?.path) {
      throw new BadRequestException('Chunk file is required');
    }

    const expectedMax =
      index === meta.totalChunks - 1
        ? meta.sizeBytes - meta.chunkSizeBytes * (meta.totalChunks - 1)
        : meta.chunkSizeBytes;
    const actual = Number(input.file.size) || 0;
    if (actual < 1 || actual > expectedMax + 1024) {
      this.cleanupTempFile(input.file);
      throw new BadRequestException('Invalid chunk size');
    }

    const target = this.chunkPath(meta.uploadId, index);
    try {
      renameSync(input.file.path, target);
    } catch {
      copyFileSync(input.file.path, target);
      try {
        unlinkSync(input.file.path);
      } catch {
        // ignore
      }
    }

    meta.received[index] = true;
    meta.expiresAt = Date.now() + SESSION_TTL_MS;
    this.writeMeta(meta);
    this.memory.set(meta.uploadId, meta);

    const receivedChunks = meta.received.filter(Boolean).length;
    return { receivedChunks, totalChunks: meta.totalChunks };
  }

  async complete(input: {
    userId: string;
    uploadId: string;
  }): Promise<MaterialUploadResult> {
    const meta = this.requireSession(input.uploadId, input.userId);
    const missing = meta.received
      .map((ok, i) => (ok ? -1 : i))
      .filter((i) => i >= 0);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Не все части файла получены (нет: ${missing.slice(0, 8).join(', ')})`,
      );
    }

    const assembled = join(this.sessionDir(meta.uploadId), `assembled-${meta.uploadId}`);
    await this.assembleChunks(meta, assembled);
    // Free chunk parts before permanent save (peak disk ≈ 1× file on same FS after this).
    this.deleteChunkParts(meta);

    const assembledSize = statSync(assembled).size;
    const maxBytes = getMaterialsMaxUploadBytes();
    if (assembledSize > maxBytes) {
      this.safeRmSession(meta.uploadId);
      this.memory.delete(meta.uploadId);
      throw new BadRequestException(
        `Размер файла не должен превышать ${formatMaterialsMaxUploadLabel(maxBytes)}`,
      );
    }
    if (assembledSize !== meta.sizeBytes) {
      this.safeRmSession(meta.uploadId);
      this.memory.delete(meta.uploadId);
      throw new BadRequestException(
        `Размер собранного файла не совпадает (${assembledSize} ≠ ${meta.sizeBytes})`,
      );
    }

    const extension = resolveMaterialsUploadExtension(meta.originalName, meta.mimeType);
    const storageName = meta.originalName.toLowerCase().endsWith(extension)
      ? meta.originalName
      : `${meta.originalName}${extension}`;

    const fakeUpload: UploadedFilePayload = {
      fieldname: 'file',
      originalname: storageName,
      encoding: '7bit',
      mimetype: meta.mimeType,
      size: assembledSize,
      destination: this.sessionDir(meta.uploadId),
      filename: `assembled-${meta.uploadId}`,
      path: assembled,
    };

    try {
      const saved = this.secureFiles.saveUploadedFile(fakeUpload);
      this.safeRmSession(meta.uploadId);
      this.memory.delete(meta.uploadId);
      this.logger.log(
        `chunked.complete uploadId=${meta.uploadId} publicKey=${saved.url} sizeBytes=${saved.sizeBytes}`,
      );
      return saved;
    } catch (err) {
      this.cleanupTempFile(fakeUpload);
      this.safeRmSession(meta.uploadId);
      this.memory.delete(meta.uploadId);
      throw err;
    }
  }

  abort(uploadId: string, userId: string): void {
    const meta = this.loadMeta(uploadId);
    if (!meta) return;
    if (meta.userId !== userId) {
      throw new NotFoundException('Upload session not found');
    }
    this.safeRmSession(uploadId);
    this.memory.delete(uploadId);
  }

  private async assembleChunks(meta: ChunkSessionMeta, targetPath: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(targetPath);
      let failed = false;

      const fail = (err: unknown) => {
        if (failed) return;
        failed = true;
        try {
          out.destroy();
        } catch {
          // ignore
        }
        try {
          rmSync(targetPath, { force: true });
        } catch {
          // ignore
        }
        reject(err instanceof Error ? err : new Error(String(err)));
      };

      out.on('error', fail);

      const writeNext = (index: number) => {
        if (failed) return;
        if (index >= meta.totalChunks) {
          out.end(() => {
            if (!failed) resolve();
          });
          return;
        }
        const part = this.chunkPath(meta.uploadId, index);
        if (!existsSync(part)) {
          fail(new BadRequestException(`Missing chunk ${index}`));
          return;
        }
        const rs = createReadStream(part);
        rs.on('error', fail);
        rs.on('end', () => writeNext(index + 1));
        rs.pipe(out, { end: false });
      };

      writeNext(0);
    });
  }

  private deleteChunkParts(meta: ChunkSessionMeta): void {
    for (let i = 0; i < meta.totalChunks; i += 1) {
      try {
        unlinkSync(this.chunkPath(meta.uploadId, i));
      } catch {
        // ignore
      }
    }
  }

  private requireSession(uploadId: string, userId: string): ChunkSessionMeta {
    const meta = this.memory.get(uploadId) || this.loadMeta(uploadId);
    if (!meta || meta.userId !== userId) {
      throw new NotFoundException('Upload session not found');
    }
    if (meta.expiresAt < Date.now()) {
      this.safeRmSession(uploadId);
      this.memory.delete(uploadId);
      throw new BadRequestException('Сессия загрузки истекла. Начните загрузку заново.');
    }
    this.memory.set(uploadId, meta);
    return meta;
  }

  private sessionDir(uploadId: string): string {
    return join(getUploadTempRoot(), 'sessions', uploadId);
  }

  private chunkPath(uploadId: string, index: number): string {
    return join(this.sessionDir(uploadId), `chunk-${String(index).padStart(5, '0')}`);
  }

  private metaPath(uploadId: string): string {
    return join(this.sessionDir(uploadId), 'meta.json');
  }

  private writeMeta(meta: ChunkSessionMeta): void {
    writeFileSync(this.metaPath(meta.uploadId), JSON.stringify(meta), 'utf8');
  }

  private loadMeta(uploadId: string): ChunkSessionMeta | null {
    const path = this.metaPath(uploadId);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as ChunkSessionMeta;
    } catch {
      return null;
    }
  }

  private safeRmSession(uploadId: string): void {
    try {
      rmSync(this.sessionDir(uploadId), { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  private cleanupTempFile(file?: UploadedFilePayload | null): void {
    if (!file?.path) return;
    try {
      unlinkSync(file.path);
    } catch {
      // ignore
    }
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [id, meta] of [...this.memory.entries()]) {
      if (meta.expiresAt < now) {
        this.safeRmSession(id);
        this.memory.delete(id);
      }
    }
  }
}
