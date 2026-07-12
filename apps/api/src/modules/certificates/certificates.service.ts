import { Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { CertificateAccessService } from '../../common/access/certificate-access.service';
import { JwtPayload } from '../auth/auth.service';
import { CertificateEntity } from './entities/certificate.entity';
import { CertificateHistoryEntity } from './entities/certificate-history.entity';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';
import { CertificatesRepository } from './certificates.repository';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly repository: CertificatesRepository,
    private readonly certificateAccess: CertificateAccessService,
  ) {}

  async findAll(actor: JwtPayload): Promise<CertificateEntity[]> {
    const where = await this.certificateAccess.scopeCertificateFilter(actor, {});
    return this.repository.filter(where as FindOptionsWhere<CertificateEntity>);
  }

  async findById(actor: JwtPayload, id: string): Promise<CertificateEntity> {
    await this.certificateAccess.assertCanReadCertificate(actor, id);
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Certificate not found');
    }
    return row;
  }

  async create(actor: JwtPayload, dto: CreateCertificateDto): Promise<CertificateEntity> {
    if (!this.certificateAccess.isAdmin(actor)) {
      await this.certificateAccess.assertCanReadStudentCertificate(actor, dto.studentId);
    }

    const saved = await this.repository.save({
      ...dto,
      status: dto.status ?? 'draft',
    });

    await this.repository.saveHistory({
      certificateId: saved.id,
      action: 'created',
      newStatus: saved.status,
      actorUserId: actor.sub,
      notes: `Certificate ${saved.registrationNumber} created`,
    });

    return saved;
  }

  async update(
    actor: JwtPayload,
    id: string,
    dto: UpdateCertificateDto,
  ): Promise<CertificateEntity> {
    const existing = await this.findById(actor, id);

    const row = await this.repository.update(id, dto);
    if (!row) {
      throw new NotFoundException('Certificate not found');
    }

    if (dto.status && dto.status !== existing.status) {
      await this.repository.saveHistory({
        certificateId: id,
        action: 'status_changed',
        previousStatus: existing.status,
        newStatus: dto.status,
        actorUserId: actor.sub,
      });
    } else {
      await this.repository.saveHistory({
        certificateId: id,
        action: 'updated',
        actorUserId: actor.sub,
      });
    }

    return row;
  }

  async delete(id: string): Promise<void> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Certificate not found');
    }
    await this.repository.delete(id);
  }

  async filter(actor: JwtPayload, where: Record<string, unknown>): Promise<CertificateEntity[]> {
    const scoped = await this.certificateAccess.scopeCertificateFilter(actor, where);
    return this.repository.filter(scoped as FindOptionsWhere<CertificateEntity>);
  }

  async findHistory(actor: JwtPayload, certificateId: string): Promise<CertificateHistoryEntity[]> {
    await this.findById(actor, certificateId);
    return this.repository.findHistoryByCertificateId(certificateId);
  }
}
