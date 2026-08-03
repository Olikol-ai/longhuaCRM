import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { extname } from 'path';
import { Repository } from 'typeorm';
import { normalizeRole } from '../../common/constants/roles';
import { STORAGE_NAMESPACE } from '../../common/storage/storage.constants';
import { StorageService } from '../../common/storage/storage.service';
import { MaterialEntity } from '../materials/entities/material.entity';
import { SignedFileUrlService } from './signed-file-url.service';
import { UploadedFilePayload } from './uploaded-file.types';
import { buildContentDisposition } from '../../common/http/content-disposition';

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
    private readonly storage: StorageService,
    @InjectRepository(MaterialEntity)
    private readonly materialRepo: Repository<MaterialEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log(`SecureFiles using storage root=${this.storage.getRoot()}`);
    await this.warnOrphanMaterialFiles();
  }

  /**
   * Issue a signed open URL only when ACL allows AND the file exists on disk.
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
      this.logMissing(materialId, null, null);
      throw new NotFoundException(FILE_MISSING_MESSAGE);
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

    const stored = this.storage.saveBuffer(
      STORAGE_NAMESPACE.Materials,
      file.buffer,
      file.originalname || `upload${extension}`,
    );
    this.logger.log(
      `material.upload publicKey=${stored.publicKey} absolutePath=${stored.absolutePath} ` +
        `sizeBytes=${stored.sizeBytes}`,
    );
    return stored.publicKey;
  }

  async streamSignedFile(token: string): Promise<StreamableFile> {
    const started = Date.now();
    const payload = this.signedFileUrl.validateSignedUrl(token);
    // Auth is the HMAC token issued after ACL at /url. Do not rebuild the full
    // materials ACL graph here — that blocked first-byte for teachers/tutors.
    const material = await this.materialRepo.findOne({
      where: { id: payload.materialId },
      select: ['id', 'fileUrl', 'status'],
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
      type: this.guessContentType(material.fileUrl),
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
    if (!fileUrl.startsWith('http') && !this.storage.exists(fileUrl)) {
      return { ...record, file_url: null, file_missing: true };
    }
    const signed = this.signedFileUrl.generateSignedUrl(userId, materialId, role);
    return { ...record, file_url: signed };
  }

  resolveStoragePath(fileUrl: string): string {
    return this.storage.requireExisting(fileUrl, 'resolveStoragePath');
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
