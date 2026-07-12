import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentEntity } from '../courses/entities/enrollment.entity';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { CertificateDraftService } from './certificate-draft.service';
import { CertificatePdfService } from './certificate-pdf.service';
import { CertificateEntity } from './entities/certificate.entity';
import { CertificateHistoryEntity } from './entities/certificate-history.entity';
import { CertificatesController } from './certificates.controller';
import { CertificatesRepository } from './certificates.repository';
import { CertificatesService } from './certificates.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CertificateEntity,
      CertificateHistoryEntity,
      StudentEntity,
      CourseTemplateEntity,
      EnrollmentEntity,
    ]),
  ],
  controllers: [CertificatesController],
  providers: [
    CertificatesRepository,
    CertificatesService,
    CertificateDraftService,
    CertificatePdfService,
  ],
  exports: [
    CertificatesRepository,
    CertificatesService,
    CertificateDraftService,
    CertificatePdfService,
    TypeOrmModule,
  ],
})
export class CertificatesModule {}
