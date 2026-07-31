import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { randomUUID } from 'crypto';
import { STORAGE_NAMESPACE, StorageNamespace } from './storage.constants';
import {
  ensureStorageLayout,
  findExistingUpload,
  getUploadsRoot,
  namespaceDir,
  normalizeStorageKey,
  resetUploadsRootCache,
  resolveUploadPath,
  toPublicStorageKey,
} from './uploads-root';

export type StoredFileResult = {
  /** Relative key under root, e.g. materials/uuid-name.pdf */
  relativeKey: string;
  /** Public DB key, e.g. /uploads/materials/uuid-name.pdf */
  publicKey: string;
  absolutePath: string;
  sizeBytes: number;
};

/**
 * Single entry point for all CRM user-file I/O.
 * Controllers/services must not invent paths with cwd/__dirname.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const configured = (this.config.get<string>('uploadsDir') || '').trim();
    if (configured) {
      process.env.UPLOADS_DIR = configured;
      resetUploadsRootCache();
    }
    const root = getUploadsRoot();
    ensureStorageLayout(root);
    this.logger.log(`StorageService root=${root}`);
  }

  getRoot(): string {
    return getUploadsRoot();
  }

  ensureNamespace(namespace: StorageNamespace): string {
    return namespaceDir(namespace);
  }

  /**
   * Persist a buffer under a namespace. Returns keys for DB + absolute path.
   */
  saveBuffer(
    namespace: StorageNamespace,
    buffer: Buffer,
    originalName: string,
    options?: { keepOriginalName?: boolean },
  ): StoredFileResult {
    if (!buffer?.length) {
      throw new Error('Empty file buffer');
    }
    const dir = this.ensureNamespace(namespace);
    const extension = extname(originalName || '').toLowerCase();
    const safeBase = basename(originalName || 'upload', extension)
      .replace(/[^a-zA-Z0-9._\u0400-\u04FF\-()+]+/g, '_')
      .slice(0, 80);
    const storedName = options?.keepOriginalName
      ? `${safeBase || 'upload'}${extension}`
      : `${randomUUID()}-${safeBase || 'upload'}${extension}`;
    const absolutePath = join(dir, storedName);
    writeFileSync(absolutePath, buffer);

    const relativeKey = `${namespace}/${storedName}`;
    const publicKey = toPublicStorageKey(relativeKey);
    const sizeBytes = buffer.length;

    this.logger.log(
      `storage.save namespace=${namespace} relativeKey=${relativeKey} ` +
        `absolutePath=${absolutePath} sizeBytes=${sizeBytes} exists=${existsSync(absolutePath)}`,
    );

    return { relativeKey, publicKey, absolutePath, sizeBytes };
  }

  /** Resolve any DB key to an absolute path that exists, or null. */
  resolveExisting(storageKey: string): string | null {
    const found = findExistingUpload(storageKey);
    this.logger.debug?.(
      `storage.resolve key=${storageKey} path=${found ?? '-'} exists=${Boolean(found)}`,
    );
    return found;
  }

  /** Resolve or throw NotFoundException with diagnostic log. */
  requireExisting(storageKey: string, context?: string): string {
    const found = this.resolveExisting(storageKey);
    if (found) return found;

    let attempted: string | null = null;
    try {
      attempted = resolveUploadPath(storageKey);
    } catch {
      attempted = null;
    }
    this.logger.warn(
      `storage.missing context=${context ?? '-'} key=${storageKey} ` +
        `resolvedAttempt=${attempted ?? '-'} exists=false root=${this.getRoot()}`,
    );
    throw new NotFoundException('Файл был удалён или недоступен.');
  }

  openReadStream(storageKey: string, context?: string) {
    const absolutePath = this.requireExisting(storageKey, context);
    return {
      absolutePath,
      stream: createReadStream(absolutePath),
      size: statSync(absolutePath).size,
      filename: basename(absolutePath),
    };
  }

  exists(storageKey: string): boolean {
    return Boolean(this.resolveExisting(storageKey));
  }

  delete(storageKey: string): boolean {
    const path = this.resolveExisting(storageKey);
    if (!path) return false;
    try {
      unlinkSync(path);
      return true;
    } catch {
      return false;
    }
  }

  /** Absolute path for a namespaced relative file (may not exist yet). */
  absoluteFor(namespace: StorageNamespace, fileName: string): string {
    const safe = basename(fileName);
    return join(this.ensureNamespace(namespace), safe);
  }

  /** Helpers for known namespaces */
  materialsDir(): string {
    return this.ensureNamespace(STORAGE_NAMESPACE.Materials);
  }

  chatDir(): string {
    return this.ensureNamespace(STORAGE_NAMESPACE.Chat);
  }

  voiceDir(): string {
    return this.ensureNamespace(STORAGE_NAMESPACE.Voice);
  }

  avatarsDir(): string {
    return this.ensureNamespace(STORAGE_NAMESPACE.Avatars);
  }

  assessmentDir(): string {
    return this.ensureNamespace(STORAGE_NAMESPACE.Assessment);
  }

  homeworkDir(): string {
    return this.ensureNamespace(STORAGE_NAMESPACE.Homework);
  }

  /** Normalize a bare filename into a chat-relative key for DB (legacy chat format). */
  chatRelativeKey(fileName: string): string {
    return basename(fileName);
  }

  /** Public materials key from relative materials/… path. */
  materialsPublicKey(relativeUnderMaterials: string): string {
    const name = normalizeStorageKey(relativeUnderMaterials).replace(/^materials\//, '');
    return toPublicStorageKey(`materials/${name}`);
  }

  mkdir(absoluteDir: string): void {
    mkdirSync(absoluteDir, { recursive: true });
  }
}
