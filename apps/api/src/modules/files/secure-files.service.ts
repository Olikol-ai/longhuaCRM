import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { Repository } from 'typeorm';
import { normalizeRole } from '../../common/constants/roles';
import {
  findExistingUpload,
  getUploadsRoot,
  listAlternateUploadRoots,
  resolveUploadPath,
} from '../../common/storage/uploads-root';
import { MaterialEntity } from '../materials/entities/material.entity';
import { MaterialAccessCheckService } from '../materials/material-access-check.service';
import { SignedFilePayload, SignedFileUrlService } from './signed-file-url.service';
import { UploadedFilePayload } from './uploaded-file.types';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
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
  '.mp3',
  '.3gp',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
]);

const FILE_MISSING_MESSAGE = 'Файл был удалён или недоступен.';

@Injectable()
export class SecureFilesService implements OnModuleInit {
  private readonly logger = new Logger(SecureFilesService.name);

  constructor(
    private readonly signedFileUrl: SignedFileUrlService,
    private readonly materialAccess: MaterialAccessCheckService,
    @InjectRepository(MaterialEntity)
    private readonly materialRepo: Repository<MaterialEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const root = getUploadsRoot();
    this.logger.log(`Uploads root pinned to ${root}`);
    const alternates = listAlternateUploadRoots();
    if (alternates.length > 0) {
      this.logger.warn(
        `Other upload directories exist (set UPLOADS_DIR to avoid split storage): ${alternates.join(', ')}`,
      );
    }
    await this.warnOrphanMaterialFiles(root);
  }

  /**
   * Issue a signed open URL only when ACL allows AND the file exists on disk.
   * Prevents "list OK / signed URL OK / stream 404" for orphan DB rows.
   */
  async createSignedFileUrl(userId: string, materialId: string, role: string): Promise<string> {
    const material = await this.materialRepo.findOne({
      where: { id: materialId },
      select: ['id', 'fileUrl', 'status', 'title'],
    });
    if (!material || material.status === 'deleted') {
      throw new NotFoundException('Material not found');
    }
    if (!material.fileUrl?.trim()) {
      this.logMissingFile({
        materialId,
        fileUrl: null,
        resolvedPath: null,
        exists: false,
        status: material.status,
      });
      throw new NotFoundException(FILE_MISSING_MESSAGE);
    }

    const resolvedPath = this.resolveExistingOrNull(material.fileUrl);
    if (!resolvedPath) {
      this.logMissingFile({
        materialId,
        fileUrl: material.fileUrl,
        resolvedPath: this.safeResolveAttempt(material.fileUrl),
        exists: false,
        status: material.status,
      });
      throw new NotFoundException(FILE_MISSING_MESSAGE);
    }

    const signed = this.signedFileUrl.generateSignedUrl(userId, materialId, role);
    if (!signed) {
      throw new BadRequestException('Не удалось сформировать ссылку на файл');
    }
    return signed;
  }

  saveUploadedFile(file: UploadedFilePayload): string {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File exceeds maximum size of 50 MB');
    }

    const extension = extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException('File type is not allowed');
    }

    const uploadDir = getUploadsRoot();
    const safeBaseName = basename(file.originalname || 'upload', extension)
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 80);
    const storedName = `${randomUUID()}-${safeBaseName || 'upload'}${extension}`;
    mkdirSync(uploadDir, { recursive: true });
    const absolutePath = join(uploadDir, storedName);
    writeFileSync(absolutePath, file.buffer);

    this.logger.log(
      `Uploaded material file storedName=${storedName} bytes=${file.size} path=${absolutePath}`,
    );

    return `/uploads/${storedName}`;
  }

  async streamSignedFile(token: string): Promise<StreamableFile> {
    const payload = this.signedFileUrl.validateSignedUrl(token);
    await this.assertMaterialFileAccess(payload);
    const material = await this.materialRepo.findOne({ where: { id: payload.materialId } });
    if (!material?.fileUrl) {
      this.logMissingFile({
        materialId: payload.materialId,
        fileUrl: material?.fileUrl ?? null,
        resolvedPath: null,
        exists: false,
        status: material?.status ?? null,
      });
      throw new NotFoundException(FILE_MISSING_MESSAGE);
    }

    const resolvedPath = this.resolveExistingOrNull(material.fileUrl);
    if (!resolvedPath) {
      this.logMissingFile({
        materialId: payload.materialId,
        fileUrl: material.fileUrl,
        resolvedPath: this.safeResolveAttempt(material.fileUrl),
        exists: false,
        status: material.status,
      });
      throw new NotFoundException(FILE_MISSING_MESSAGE);
    }

    return this.streamByStorageKey(material.fileUrl, {
      disposition: 'inline',
      filename: basename(resolvedPath),
    });
  }

  /**
   * Stream a file previously stored via saveUploadedFile (Assessment attachments, etc.).
   * Callers must authorize access before invoking this method.
   */
  streamByStorageKey(
    storageKey: string,
    options?: {
      mime?: string | null;
      filename?: string | null;
      disposition?: 'inline' | 'attachment';
    },
  ): StreamableFile {
    const absolutePath =
      findExistingUpload(storageKey) ||
      (() => {
        try {
          return resolveUploadPath(storageKey);
        } catch {
          return null;
        }
      })();

    if (!absolutePath || !existsSync(absolutePath)) {
      this.logMissingFile({
        materialId: null,
        fileUrl: storageKey,
        resolvedPath: absolutePath,
        exists: false,
        status: null,
      });
      throw new NotFoundException(FILE_MISSING_MESSAGE);
    }
    const disposition = options?.disposition ?? 'inline';
    const filename = (options?.filename?.trim() || basename(absolutePath)).replace(
      /["\r\n]/g,
      '_',
    );
    const stream = createReadStream(absolutePath);
    return new StreamableFile(stream, {
      type: options?.mime?.trim() || this.guessContentType(storageKey),
      disposition: `${disposition}; filename="${filename}"`,
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
    // Do not claim a signed URL when the blob is already gone from disk.
    if (!fileUrl.startsWith('http') && !findExistingUpload(fileUrl)) {
      return { ...record, file_url: null, file_missing: true };
    }
    const signed = this.signedFileUrl.generateSignedUrl(userId, materialId, role);
    return { ...record, file_url: signed };
  }

  private async assertMaterialFileAccess(payload: SignedFilePayload): Promise<void> {
    const allowed = await this.materialAccess.canAccessMaterial(
      payload.userId,
      payload.materialId,
      payload.role,
    );
    const material = await this.materialRepo.findOne({ where: { id: payload.materialId } });
    if (!material || material.status === 'deleted') {
      throw new NotFoundException('Material not found');
    }
    if (!allowed) {
      throw new ForbiddenException('Forbidden: no access to this material file');
    }
  }

  resolveStoragePath(fileUrl: string): string {
    const found = findExistingUpload(fileUrl);
    if (found) return found;
    return resolveUploadPath(fileUrl);
  }

  private resolveExistingOrNull(fileUrl: string): string | null {
    return findExistingUpload(fileUrl);
  }

  private safeResolveAttempt(fileUrl: string): string | null {
    try {
      return resolveUploadPath(fileUrl);
    } catch {
      return null;
    }
  }

  private logMissingFile(info: {
    materialId: string | null;
    fileUrl: string | null;
    resolvedPath: string | null;
    exists: boolean;
    status: string | null;
  }): void {
    this.logger.warn(
      `Material file missing materialId=${info.materialId ?? '-'} ` +
        `fileUrl=${info.fileUrl ?? '-'} resolvedPath=${info.resolvedPath ?? '-'} ` +
        `exists=${info.exists} status=${info.status ?? '-'} uploadsRoot=${getUploadsRoot()}`,
    );
  }

  private async warnOrphanMaterialFiles(root: string): Promise<void> {
    const rows = await this.materialRepo.find({
      where: { status: 'active' },
      select: ['id', 'fileUrl', 'title'],
    });
    let missing = 0;
    for (const row of rows) {
      const fileUrl = row.fileUrl?.trim();
      if (!fileUrl || /^https?:\/\//i.test(fileUrl)) {
        continue;
      }
      if (!findExistingUpload(fileUrl)) {
        missing += 1;
        this.logger.warn(
          `Orphan material on disk missing id=${row.id} title=${row.title} fileUrl=${fileUrl}`,
        );
      }
    }
    if (missing > 0) {
      this.logger.warn(
        `${missing} active material(s) reference files missing under uploads root ${root}`,
      );
    }
  }

  private guessContentType(fileUrl: string): string {
    const lower = fileUrl.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.webm')) return 'video/webm';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    if (lower.endsWith('.mp3')) return 'audio/mpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.docx')) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (lower.endsWith('.xlsx')) {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    if (lower.endsWith('.pptx')) {
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
    return 'application/octet-stream';
  }
}
