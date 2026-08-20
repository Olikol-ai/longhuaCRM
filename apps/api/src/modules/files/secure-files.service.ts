import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { basename, extname } from 'path';
import { unlinkSync } from 'fs';
import { Repository } from 'typeorm';
import { normalizeRole } from '../../common/constants/roles';
import { STORAGE_NAMESPACE } from '../../common/storage/storage.constants';
import { StorageService } from '../../common/storage/storage.service';
import { MaterialEntity } from '../materials/entities/material.entity';
import {
  detectMaterialFileKind,
  formatMaterialsMaxUploadLabel,
  getMaterialsMaxUploadBytes,
  guessMimeFromExtension,
  MATERIALS_ALLOWED_EXTENSIONS,
} from './material-upload.limits';
import {
  classifyMaterialFileUrl,
  isExternalMaterialUrl,
} from './material-open-url.util';
import { SignedFileUrlService } from './signed-file-url.service';
import { UploadedFilePayload } from './uploaded-file.types';
import { buildContentDisposition } from '../../common/http/content-disposition';

const FILE_MISSING_MESSAGE = 'Файл был удалён или недоступен.';

export type MaterialUploadResult = {
  url: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
  storedName: string;
  fileType: ReturnType<typeof detectMaterialFileKind>;
};

@Injectable()
export class SecureFilesService implements OnModuleInit {
  private readonly logger = new Logger(SecureFilesService.name);

  constructor(
    private readonly signedFileUrl: SignedFileUrlService,
    private readonly storage: StorageService,
    @InjectRepository(MaterialEntity)
    private readonly materialRepo: Repository<MaterialEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log(
      `SecureFiles using storage root=${this.storage.getRoot()} ` +
        `maxUploadBytes=${getMaterialsMaxUploadBytes()}`,
    );
    await this.warnOrphanMaterialFiles();
  }

  /**
   * Issue an open URL after ACL has already allowed the user.
   * Local uploads → signed blob URL. External http(s) (Canva, etc.) → the
   * stored URL unchanged (never user-specific, never proxied).
   */
  async createSignedFileUrl(userId: string, materialId: string, role: string): Promise<string> {
    const material = await this.materialRepo.findOne({
      where: { id: materialId },
      select: ['id', 'fileUrl', 'fileType', 'status', 'title'],
    });
    if (!material || material.status === 'deleted') {
      throw new NotFoundException('Material not found');
    }
    if (!material.fileUrl?.trim()) {
      this.logMissing(materialId, null, null);
      throw new NotFoundException(FILE_MISSING_MESSAGE);
    }

    const classified = classifyMaterialFileUrl(material.fileUrl);
    this.logOpenDiagnostic({
      materialId,
      userId,
      role,
      acl: 'allow',
      fileType: material.fileType ?? null,
      classification: classified,
    });

    if (classified.kind === 'external-canva' || classified.kind === 'external-http') {
      if (!classified.openUrl) {
        throw new NotFoundException(FILE_MISSING_MESSAGE);
      }
      return classified.openUrl;
    }

    const resolvedPath = this.storage.resolveExisting(material.fileUrl);
    if (!resolvedPath) {
      this.logMissing(materialId, material.fileUrl, null);
      throw new NotFoundException(FILE_MISSING_MESSAGE);
    }

    const signed = this.signedFileUrl.generateSignedUrl(userId, materialId, role);
    if (!signed) {
      throw new BadRequestException('Не удалось сформировать ссылку на файл');
    }
    return signed;
  }

  logDeniedOpen(userId: string, materialId: string, role: string): void {
    this.logOpenDiagnostic({
      materialId,
      userId,
      role,
      acl: 'deny',
      fileType: null,
      classification: classifyMaterialFileUrl(null),
    });
  }

  saveUploadedFile(file: UploadedFilePayload): MaterialUploadResult {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const maxBytes = getMaterialsMaxUploadBytes();
    const size = Number(file.size) || file.buffer?.length || 0;
    if (!size) {
      throw new BadRequestException('File is required');
    }
    if (size > maxBytes) {
      throw new BadRequestException(
        `Размер файла не должен превышать ${formatMaterialsMaxUploadLabel(maxBytes)}`,
      );
    }

    const originalName = file.originalname || 'upload';
    const extension = extname(originalName).toLowerCase();
    if (!MATERIALS_ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException('File type is not allowed');
    }

    const mimeType =
      (file.mimetype && file.mimetype !== 'application/octet-stream'
        ? file.mimetype
        : null) || guessMimeFromExtension(extension);

    let stored;
    try {
      if (file.path) {
        stored = this.storage.saveFromPath(
          STORAGE_NAMESPACE.Materials,
          file.path,
          originalName,
        );
      } else if (file.buffer?.length) {
        stored = this.storage.saveBuffer(
          STORAGE_NAMESPACE.Materials,
          file.buffer,
          originalName,
        );
      } else {
        throw new BadRequestException('File is required');
      }
    } catch (err) {
      this.cleanupTempUpload(file);
      throw err;
    }

    // Disk storage already moved/deleted the temp file; clear any leftover.
    this.cleanupTempUpload(file);

    this.logger.log(
      `material.upload publicKey=${stored.publicKey} absolutePath=${stored.absolutePath} ` +
        `sizeBytes=${stored.sizeBytes} mime=${mimeType}`,
    );

    return {
      url: stored.publicKey,
      mimeType,
      sizeBytes: stored.sizeBytes,
      originalName,
      storedName: basename(stored.absolutePath),
      fileType: detectMaterialFileKind(originalName),
    };
  }

  async streamSignedFile(token: string): Promise<StreamableFile> {
    const started = Date.now();
    const payload = this.signedFileUrl.validateSignedUrl(token);
    // Auth is the HMAC token issued after ACL at /url. Do not rebuild the full
    // materials ACL graph here — that blocked first-byte for teachers/tutors.
    const material = await this.materialRepo.findOne({
      where: { id: payload.materialId },
      select: ['id', 'fileUrl', 'status', 'mimeType'],
    });
    if (!material?.fileUrl || material.status === 'deleted') {
      this.logMissing(payload.materialId, material?.fileUrl ?? null, null);
      throw new NotFoundException(FILE_MISSING_MESSAGE);
    }

    const resolved = this.storage.openReadStream(
      material.fileUrl,
      `material:${payload.materialId}`,
    );
    this.logger.log(
      `material.stream materialId=${payload.materialId} sizeBytes=${resolved.size} ` +
        `setupMs=${Date.now() - started}`,
    );
    return new StreamableFile(resolved.stream, {
      type: material.mimeType?.trim() || this.guessContentType(material.fileUrl),
      disposition: buildContentDisposition('inline', resolved.filename),
      length: resolved.size,
    });
  }

  streamByStorageKey(
    storageKey: string,
    options?: {
      mime?: string | null;
      filename?: string | null;
      disposition?: 'inline' | 'attachment';
    },
  ): StreamableFile {
    const resolved = this.storage.openReadStream(storageKey, 'streamByStorageKey');
    const disposition = options?.disposition ?? 'inline';
    const filename = options?.filename?.trim() || resolved.filename;
    return new StreamableFile(resolved.stream, {
      type: options?.mime?.trim() || this.guessContentType(storageKey),
      disposition: buildContentDisposition(disposition, filename),
      length: resolved.size,
    });
  }

  maskMaterialFileUrls(
    records: Record<string, unknown>[],
    userId: string,
    role: string,
  ): Record<string, unknown>[] {
    const normalizedRole = normalizeRole(role);
    return records.map((record) => this.maskMaterialRecord(record, userId, normalizedRole));
  }

  private maskMaterialRecord(
    record: Record<string, unknown>,
    userId: string,
    role: string,
  ): Record<string, unknown> {
    const fileUrl = String(record.file_url ?? record.fileUrl ?? '').trim();
    if (!fileUrl) {
      return record;
    }
    const materialId = String(record.id ?? '');
    if (!materialId) {
      return { ...record, file_url: null };
    }
    if (isExternalMaterialUrl(fileUrl)) {
      const classified = classifyMaterialFileUrl(fileUrl);
      return { ...record, file_url: classified.openUrl ?? fileUrl };
    }
    if (!this.storage.exists(fileUrl)) {
      return { ...record, file_url: null, file_missing: true };
    }
    const signed = this.signedFileUrl.generateSignedUrl(userId, materialId, role);
    return { ...record, file_url: signed };
  }

  resolveStoragePath(fileUrl: string): string {
    return this.storage.requireExisting(fileUrl, 'resolveStoragePath');
  }

  private cleanupTempUpload(file: UploadedFilePayload): void {
    if (!file?.path) return;
    try {
      unlinkSync(file.path);
    } catch {
      // already moved or absent
    }
  }

  private logOpenDiagnostic(params: {
    materialId: string;
    userId: string;
    role: string;
    acl: 'allow' | 'deny';
    fileType: string | null;
    classification: ReturnType<typeof classifyMaterialFileUrl>;
  }): void {
    this.logger.log(
      `material.open materialId=${params.materialId} userId=${params.userId} ` +
        `role=${normalizeRole(params.role)} acl=${params.acl} ` +
        `materialType=${params.fileType ?? '-'} urlType=${params.classification.kind} ` +
        `urlHostname=${params.classification.hostname ?? '-'}`,
    );
  }

  private logMissing(
    materialId: string | null,
    fileUrl: string | null,
    resolvedPath: string | null,
  ): void {
    this.logger.warn(
      `Material file missing materialId=${materialId ?? '-'} fileUrl=${fileUrl ?? '-'} ` +
        `resolvedPath=${resolvedPath ?? '-'} exists=false root=${this.storage.getRoot()}`,
    );
  }

  private async warnOrphanMaterialFiles(): Promise<void> {
    const rows = await this.materialRepo.find({
      where: { status: 'active' },
      select: ['id', 'fileUrl', 'title'],
    });
    let missing = 0;
    for (const row of rows) {
      const fileUrl = row.fileUrl?.trim();
      if (!fileUrl || /^https?:\/\//i.test(fileUrl)) continue;
      if (!this.storage.exists(fileUrl)) {
        missing += 1;
        this.logger.warn(
          `Orphan material on disk missing id=${row.id} title=${row.title} fileUrl=${fileUrl}`,
        );
      }
    }
    if (missing > 0) {
      this.logger.warn(
        `${missing} active material(s) reference files missing under ${this.storage.getRoot()}`,
      );
    }
  }

  private guessContentType(fileUrl: string): string {
    const lower = fileUrl.toLowerCase();
    const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';
    return guessMimeFromExtension(ext);
  }
}
