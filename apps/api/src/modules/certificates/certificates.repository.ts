import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Not, Repository } from 'typeorm';
import { CertificateEntity } from './entities/certificate.entity';
import { CertificateHistoryEntity } from './entities/certificate-history.entity';

@Injectable()
export class CertificatesRepository {
  constructor(
    @InjectRepository(CertificateEntity)
    private readonly certificateRepo: Repository<CertificateEntity>,
    @InjectRepository(CertificateHistoryEntity)
    private readonly historyRepo: Repository<CertificateHistoryEntity>,
  ) {}

  findAll(): Promise<CertificateEntity[]> {
    return this.certificateRepo.find();
  }

  findById(id: string): Promise<CertificateEntity | null> {
    return this.certificateRepo.findOne({ where: { id } });
  }

  save(entity: Partial<CertificateEntity>): Promise<CertificateEntity> {
    return this.certificateRepo.save(this.certificateRepo.create(entity));
  }

  async update(id: string, data: Partial<CertificateEntity>): Promise<CertificateEntity | null> {
    await this.certificateRepo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.certificateRepo.delete({ id });
  }

  filter(where: FindOptionsWhere<CertificateEntity>): Promise<CertificateEntity[]> {
    return this.certificateRepo.find({ where });
  }

  findByStudentAndCourse(studentId: string, courseId: string): Promise<CertificateEntity | null> {
    return this.certificateRepo.findOne({ where: { studentId, courseId } });
  }

  findByRegistrationNumber(
    registrationNumber: string,
    excludeId?: string,
  ): Promise<CertificateEntity | null> {
    const where: FindOptionsWhere<CertificateEntity> = { registrationNumber };
    if (excludeId) {
      where.id = Not(excludeId);
    }
    return this.certificateRepo.findOne({ where });
  }

  findByBlankSeriesAndNumber(
    blankSeries: string,
    blankNumber: string,
    excludeId?: string,
  ): Promise<CertificateEntity | null> {
    const where: FindOptionsWhere<CertificateEntity> = { blankSeries, blankNumber };
    if (excludeId) {
      where.id = Not(excludeId);
    }
    return this.certificateRepo.findOne({ where });
  }

  findActiveByStudentAndCourse(
    studentId: string,
    courseId: string,
    excludeId?: string,
  ): Promise<CertificateEntity | null> {
    const where: FindOptionsWhere<CertificateEntity> = {
      studentId,
      courseId,
      status: In(['issued', 'sent']),
    };
    if (excludeId) {
      where.id = Not(excludeId);
    }
    return this.certificateRepo.findOne({ where });
  }

  saveHistory(entity: Partial<CertificateHistoryEntity>): Promise<CertificateHistoryEntity> {
    return this.historyRepo.save(this.historyRepo.create(entity));
  }

  findHistoryByCertificateId(certificateId: string): Promise<CertificateHistoryEntity[]> {
    return this.historyRepo.find({
      where: { certificateId },
      order: { createdAt: 'DESC' },
    });
  }
}
