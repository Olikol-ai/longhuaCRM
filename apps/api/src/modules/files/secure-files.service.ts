import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync } from 'fs';
import { basename, join, normalize } from 'path';
import { Repository } from 'typeorm';
import { normalizeRole } from '../../common/constants/roles';
import { MaterialEntity } from '../materials/entities/material.entity';
import { MaterialAccessCheckService } from '../materials/material-access-check.service';
import { SignedFilePayload, SignedFileUrlService } from './signed-file-url.service';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

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

  async streamSignedFile(token: string): Promise<StreamableFile> {
    const payload = this.signedFileUrl.validateSignedUrl(token);
    await this.assertMaterialFileAccess(payload);
    const material = await this.materialRepo.findOne({ where: { id: payload.materialId } });
    if (!material?.fileUrl) {
      throw new NotFoundException('Material file not found');
    }
    const absolutePath = this.resolveStoragePath(material.fileUrl);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File not found on disk');
    }
    const stream = createReadStream(absolutePath);
    return new StreamableFile(stream, {
      type: this.guessContentType(material.fileUrl),
      disposition: `inline; filename="${basename(absolutePath)}"`,
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
    if (!material) {
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
