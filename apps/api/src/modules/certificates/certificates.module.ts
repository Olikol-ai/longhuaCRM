import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentEntity } from '../courses/entities/enrollment.entity';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentEntity } from '../students/entities/student.entity';
import { TelegramModule } from '../telegram/telegram.module';
import { CertificateDraftService } from './certificate-draft.service';
import { CertificateIssuedNotifier } from './certificate-issued-notifier.service';
import { CertificatePdfService } from './certificate-pdf.service';
import { CertificateEntity } from './entities/certificate.entity';
import { CertificateHistoryEntity } from './entities/certificate-history.entity';
import { CertificatesController } from './certificates.controller';
import { CertificateVerificationController } from './certificate-verification.controller';
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
    NotificationsModule,
    TelegramModule,
  ],
  controllers: [CertificatesController, CertificateVerificationController],
  providers: [
    CertificatesRepository,
    CertificatesService,
    CertificateDraftService,
    CertificatePdfService,
    CertificateIssuedNotifier,
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
