import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EnrollmentEntity } from '../courses/entities/enrollment.entity';
import { CertificateEntity } from './entities/certificate.entity';
import { CertificateHistoryEntity } from './entities/certificate-history.entity';
import { CertificatesRepository } from './certificates.repository';

@Injectable()
export class CertificateDraftService {
  constructor(private readonly certificatesRepository: CertificatesRepository) {}

  async createDraftForEnrollment(
    enrollment: EnrollmentEntity,
    manager?: EntityManager,
  ): Promise<void> {
    if (!enrollment.courseTemplateId || !enrollment.studentId) {
      return;
    }

    const existing = manager
      ? await manager.getRepository(CertificateEntity).findOne({
          where: {
            studentId: enrollment.studentId,
            courseId: enrollment.courseTemplateId,
          },
        })
      : await this.certificatesRepository.findByStudentAndCourse(
          enrollment.studentId,
          enrollment.courseTemplateId,
        );

    if (existing) {
      return;
    }

    const registrationNumber = `DRAFT-${enrollment.id.slice(0, 8).toUpperCase()}-${Date.now()}`;
    const payload: Partial<CertificateEntity> = {
      studentId: enrollment.studentId,
      courseId: enrollment.courseTemplateId,
      registrationNumber,
      status: 'draft',
      issueDate: null,
    };

    if (manager) {
      try {
        const certRepo = manager.getRepository(CertificateEntity);
        const saved = await certRepo.save(certRepo.create(payload));
        await manager.getRepository(CertificateHistoryEntity).save({
          certificateId: saved.id,
          action: 'auto_draft_created',
          newStatus: 'draft',
          notes: `Auto-created when enrollment ${enrollment.id} completed`,
        });
      } catch {
        return;
      }
      return;
    }

    const saved = await this.certificatesRepository.save(payload);
    await this.certificatesRepository.saveHistory({
      certificateId: saved.id,
      action: 'auto_draft_created',
      newStatus: 'draft',
      notes: `Auto-created when enrollment ${enrollment.id} completed`,
    });
  }
}
