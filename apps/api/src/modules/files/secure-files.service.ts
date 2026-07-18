import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, extname, join, normalize } from 'path';
import { Repository } from 'typeorm';
import { normalizeRole } from '../../common/constants/roles';
import { MaterialEntity } from '../materials/entities/material.entity';
import { MaterialAccessCheckService } from '../materials/material-access-check.service';
import { SignedFilePayload, SignedFileUrlService } from './signed-file-url.service';
import { UploadedFilePayload } from './uploaded-file.types';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.pptx',
  '.ppt',
  '.mp4',
  '.webm',
  '.mov',
  '.3gp',
  '.jpg',
  '.jpeg',
  '.png',
]);

@Injectable()
export class SecureFilesService {
  constructor(
    private readonly signedFileUrl: SignedFileUrlService,
    private readonly materialAccess: MaterialAccessCheckService,
    @InjectRepository(MaterialEntity)
    private readonly materialRepo: Repository<MaterialEntity>,
  ) {}

  createSignedFileUrl(userId: string, materialId: string, role: string): string | null {
    return this.signedFileUrl.generateSignedUrl(userId, materialId, role);
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

    const safeBaseName = basename(file.originalname || 'upload', extension)
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 80);
    const storedName = `${randomUUID()}-${safeBaseName || 'upload'}${extension}`;
    mkdirSync(UPLOAD_DIR, { recursive: true });
    const absolutePath = join(UPLOAD_DIR, storedName);
    writeFileSync(absolutePath, file.buffer);

    return `/uploads/${storedName}`;
  }

  async streamSignedFile(token: string): Promise<StreamableFile> {
    const payload = this.signedFileUrl.validateSignedUrl(token);
    await this.assertMaterialFileAccess(payload);
    const material = await this.materialRepo.findOne({ where: { id: payload.materialId } });
    if (!material?.fileUrl) {
      throw new NotFoundException('Material file not found');
    }
    return this.streamByStorageKey(material.fileUrl, {
      disposition: 'inline',
      filename: basename(this.resolveStoragePath(material.fileUrl)),
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
    const absolutePath = this.resolveStoragePath(storageKey);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File not found on disk');
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
    const raw = fileUrl.replace(/^\/uploads\//, '').replace(/^uploads\//, '');
    const filename = basename(normalize(raw));
    if (!filename || filename === '.' || filename.includes('..')) {
      throw new ForbiddenException('Invalid file path');
    }
    const absolute = join(UPLOAD_DIR, filename);
    const normalizedAbsolute = normalize(absolute);
    if (!normalizedAbsolute.startsWith(normalize(UPLOAD_DIR))) {
      throw new ForbiddenException('Invalid file path');
    }
    return normalizedAbsolute;
  }

  private guessContentType(fileUrl: string): string {
    const lower = fileUrl.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.webm')) return 'video/webm';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.pptx')) {
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
    return 'application/octet-stream';
  }
}
