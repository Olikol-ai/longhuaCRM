import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, Not } from 'typeorm';
import { CertificateAccessService } from '../../common/access/certificate-access.service';
import { JwtPayload } from '../auth/auth.service';
import { EnrollmentEntity } from '../courses/entities/enrollment.entity';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { StudentEntity } from '../students/entities/student.entity';
import {
  ACTIVE_CERTIFICATE_STATUSES,
  canTransitionCertificateStatus,
  TERMINAL_CERTIFICATE_STATUSES,
} from './certificate-lifecycle';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { ReissueCertificateDto } from './dto/reissue-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';
import { CertificateEntity, CertificateStatus } from './entities/certificate.entity';
import { CertificateHistoryEntity } from './entities/certificate-history.entity';
import { CertificatesRepository } from './certificates.repository';

const IMMUTABLE_AFTER_ISSUE: Array<keyof CertificateEntity> = [
  'studentId',
  'courseId',
  'registrationNumber',
  'blankSeries',
  'blankNumber',
  'issueDate',
];

@Injectable()
export class CertificatesService {
  constructor(
    private readonly repository: CertificatesRepository,
    private readonly certificateAccess: CertificateAccessService,
    @InjectDataSource() private readonly dataSource: DataSource,
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

    const payload = this.normalizeCertificateInput(dto);
    const status = (payload.status ?? dto.status ?? 'draft') as CertificateStatus;

    await this.assertStudentExists(dto.studentId);
    await this.assertCourseExists(dto.courseId);
    await this.assertUniqueRegistrationNumber(dto.registrationNumber.trim());
    await this.assertUniqueBlank(payload.blankSeries, payload.blankNumber);

    if (ACTIVE_CERTIFICATE_STATUSES.has(status)) {
      await this.assertEnrollmentCompleted(dto.studentId, dto.courseId);
      await this.assertIssueRequirements({
        registrationNumber: dto.registrationNumber.trim(),
        blankSeries: payload.blankSeries ?? null,
        blankNumber: payload.blankNumber ?? null,
        issueDate: payload.issueDate ?? null,
        status,
      });
      await this.assertNoActiveCertificate(dto.studentId, dto.courseId);
    } else if (status === 'draft') {
      const existingDraft = await this.repository.findByStudentAndCourse(
        dto.studentId,
        dto.courseId,
      );
      if (existingDraft && existingDraft.status === 'draft') {
        throw new ConflictException('Draft certificate already exists for this student and course');
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const certRepo = manager.getRepository(CertificateEntity);
      const saved = await certRepo.save(
        certRepo.create({
          studentId: dto.studentId,
          courseId: dto.courseId,
          registrationNumber: dto.registrationNumber.trim(),
          blankSeries: payload.blankSeries ?? null,
          blankNumber: payload.blankNumber ?? null,
          issueDate: payload.issueDate ?? null,
          recipientSignature: payload.recipientSignature ?? null,
          status,
        }),
      );

      await manager.getRepository(CertificateHistoryEntity).save({
        certificateId: saved.id,
        action: status === 'issued' ? 'issued' : 'created',
        newStatus: saved.status,
        actorUserId: actor.sub,
        notes:
          status === 'issued'
            ? `Certificate ${saved.registrationNumber} issued by admin ${actor.sub}`
            : `Certificate ${saved.registrationNumber} created`,
      });

      return saved;
    });
  }

  async update(
    actor: JwtPayload,
    id: string,
    dto: UpdateCertificateDto,
  ): Promise<CertificateEntity> {
    const existing = await this.findById(actor, id);
    const payload = this.normalizeCertificateInput(dto, existing);

    if (TERMINAL_CERTIFICATE_STATUSES.has(existing.status)) {
      throw new BadRequestException(`Certificate in status "${existing.status}" cannot be modified`);
    }

    this.assertImmutableFields(existing, payload);

    const previousStatus = existing.status;
    const nextStatus = (payload.status ?? existing.status) as CertificateStatus;
    if (nextStatus !== previousStatus && !canTransitionCertificateStatus(previousStatus, nextStatus)) {
      throw new BadRequestException(
        `Invalid certificate status transition: ${previousStatus} -> ${nextStatus}`,
      );
    }

    const becomingIssued = previousStatus === 'draft' && nextStatus === 'issued';

    if (payload.registrationNumber && payload.registrationNumber !== existing.registrationNumber) {
      await this.assertUniqueRegistrationNumber(payload.registrationNumber, id);
    }

    if (
      (payload.blankSeries && payload.blankSeries !== existing.blankSeries) ||
      (payload.blankNumber && payload.blankNumber !== existing.blankNumber)
    ) {
      await this.assertUniqueBlank(
        payload.blankSeries ?? existing.blankSeries,
        payload.blankNumber ?? existing.blankNumber,
        id,
      );
    }

    if (becomingIssued) {
      await this.assertEnrollmentCompleted(existing.studentId, existing.courseId);
      await this.assertIssueRequirements({ ...existing, ...payload, status: nextStatus });
      await this.assertNoActiveCertificate(existing.studentId, existing.courseId, id);
    }

    if (ACTIVE_CERTIFICATE_STATUSES.has(nextStatus)) {
      await this.assertIssueRequirements({ ...existing, ...payload, status: nextStatus });
    }

    return this.dataSource.transaction(async (manager) => {
      const certRepo = manager.getRepository(CertificateEntity);
      const locked = await certRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException('Certificate not found');
      }
      if (TERMINAL_CERTIFICATE_STATUSES.has(locked.status)) {
        throw new BadRequestException(
          `Certificate in status "${locked.status}" cannot be modified`,
        );
      }

      const previousStatus = locked.status;
      const nextStatus = (payload.status ?? locked.status) as CertificateStatus;
      if (
        nextStatus !== previousStatus &&
        !canTransitionCertificateStatus(previousStatus, nextStatus)
      ) {
        throw new BadRequestException(
          `Invalid certificate status transition: ${previousStatus} -> ${nextStatus}`,
        );
      }

      const becomingIssued = previousStatus === 'draft' && nextStatus === 'issued';
      if (becomingIssued) {
        await this.assertNoActiveCertificateInTx(
          manager,
          locked.studentId,
          locked.courseId,
          id,
        );
      }

      const saved = await certRepo.save({
        ...locked,
        ...payload,
        status: nextStatus,
      });

      const historyRepo = manager.getRepository(CertificateHistoryEntity);
      if (nextStatus !== previousStatus) {
        await historyRepo.save({
          certificateId: id,
          action: becomingIssued ? 'issued' : 'status_changed',
          previousStatus,
          newStatus: nextStatus,
          actorUserId: actor.sub,
          notes: becomingIssued
            ? `Certificate issued by admin ${actor.sub}`
            : `Status changed to ${nextStatus}`,
        });
      } else if (Object.keys(payload).length > 0) {
        await historyRepo.save({
          certificateId: id,
          action: 'updated',
          actorUserId: actor.sub,
          notes: 'Certificate fields updated',
        });
      }

      return saved;
    });
  }

  async reissue(
    actor: JwtPayload,
    id: string,
    dto: ReissueCertificateDto,
  ): Promise<CertificateEntity> {
    const original = await this.findById(actor, id);

    if (!ACTIVE_CERTIFICATE_STATUSES.has(original.status)) {
      throw new BadRequestException('Only issued or sent certificates can be reissued');
    }

    const registrationNumber = dto.registrationNumber.trim();
    const blankSeries = dto.blankSeries.trim();
    const blankNumber = dto.blankNumber.trim();
    const issueDate = dto.issueDate?.trim() || new Date().toISOString().split('T')[0];

    this.assertValidIssueDate(issueDate);
    await this.assertUniqueRegistrationNumber(registrationNumber);
    await this.assertUniqueBlank(blankSeries, blankNumber);
    await this.assertEnrollmentCompleted(original.studentId, original.courseId);

    return this.dataSource.transaction(async (manager) => {
      const certRepo = manager.getRepository(CertificateEntity);
      const historyRepo = manager.getRepository(CertificateHistoryEntity);

      const locked = await certRepo.findOne({
        where: { id: original.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || !ACTIVE_CERTIFICATE_STATUSES.has(locked.status)) {
        throw new BadRequestException('Only issued or sent certificates can be reissued');
      }

      const previousStatus = locked.status;

      await certRepo.update({ id: locked.id }, { status: 'duplicate' });

      await historyRepo.save({
        certificateId: locked.id,
        action: 'reissued',
        previousStatus,
        newStatus: 'duplicate',
        actorUserId: actor.sub,
        notes: `Superseded by reissue with registration ${registrationNumber}`,
      });

      const reissued = await certRepo.save(
        certRepo.create({
          studentId: locked.studentId,
          courseId: locked.courseId,
          registrationNumber,
          blankSeries,
          blankNumber,
          issueDate,
          status: 'issued',
        }),
      );

      await historyRepo.save({
        certificateId: reissued.id,
        action: 'reissue_created',
        newStatus: 'issued',
        actorUserId: actor.sub,
        notes: `Reissued from certificate ${locked.id} (${locked.registrationNumber})`,
      });

      return reissued;
    });
  }

  async delete(actor: JwtPayload, id: string): Promise<void> {
    await this.findById(actor, id);
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Certificate not found');
    }

    if (row.status !== 'draft') {
      throw new BadRequestException('Only draft certificates can be deleted. Use revoke instead.');
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

  assertPdfAllowed(certificate: CertificateEntity): void {
    if (certificate.status === 'draft') {
      throw new BadRequestException('PDF is available only for issued certificates');
    }
    if (certificate.status === 'revoked') {
      throw new BadRequestException('Revoked certificate PDF is not available');
    }
  }

  private normalizeCertificateInput(
    dto: CreateCertificateDto | UpdateCertificateDto,
    existing?: CertificateEntity,
  ): Partial<CertificateEntity> {
    const payload: Partial<CertificateEntity> = { ...dto };

    if (dto.registrationNumber !== undefined) {
      payload.registrationNumber = dto.registrationNumber.trim();
    }
    if (dto.blankSeries !== undefined) {
      payload.blankSeries = dto.blankSeries.trim() || null;
    }
    if (dto.blankNumber !== undefined) {
      payload.blankNumber = dto.blankNumber.trim() || null;
    }
    if (dto.issueDate !== undefined) {
      payload.issueDate = dto.issueDate.trim() || null;
    }

    if (existing) {
      return payload;
    }

    return payload;
  }

  private assertImmutableFields(
    existing: CertificateEntity,
    payload: Partial<CertificateEntity>,
  ): void {
    if (existing.status === 'draft') {
      return;
    }

    for (const field of IMMUTABLE_AFTER_ISSUE) {
      const nextValue = payload[field];
      if (nextValue !== undefined && nextValue !== existing[field]) {
        throw new BadRequestException(`Field "${field}" cannot be changed after issuance`);
      }
    }
  }

  private async assertStudentExists(studentId: string): Promise<void> {
    const student = await this.dataSource.getRepository(StudentEntity).findOne({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
  }

  private async assertCourseExists(courseId: string): Promise<void> {
    const course = await this.dataSource.getRepository(CourseTemplateEntity).findOne({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
  }

  private async assertEnrollmentCompleted(studentId: string, courseId: string): Promise<void> {
    const enrollment = await this.dataSource.getRepository(EnrollmentEntity).findOne({
      where: { studentId, courseTemplateId: courseId },
    });

    if (!enrollment) {
      throw new BadRequestException('Student is not enrolled in this course');
    }

    const completed =
      enrollment.status === 'completed' ||
      enrollment.completedLessons >= enrollment.totalLessons;

    if (!completed) {
      throw new BadRequestException('Course must be completed before issuing a certificate');
    }
  }

  private assertIssueRequirements(
    certificate: Pick<
      CertificateEntity,
      'blankSeries' | 'blankNumber' | 'issueDate' | 'registrationNumber' | 'status'
    >,
  ): void {
    if (!certificate.registrationNumber?.trim()) {
      throw new BadRequestException('Registration number is required');
    }
    if (!certificate.blankSeries?.trim() || !certificate.blankNumber?.trim()) {
      throw new BadRequestException('Blank series and blank number are required for issuance');
    }
    if (!certificate.issueDate?.trim()) {
      throw new BadRequestException('Issue date is required for issuance');
    }
    this.assertValidIssueDate(certificate.issueDate);
  }

  private assertValidIssueDate(issueDate: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
      throw new BadRequestException('Issue date must be in YYYY-MM-DD format');
    }

    const parsed = new Date(`${issueDate}T23:59:59.999`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Issue date is invalid');
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (parsed > today) {
      throw new BadRequestException('Issue date cannot be in the future');
    }
  }

  private async assertUniqueRegistrationNumber(
    registrationNumber: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.repository.findByRegistrationNumber(registrationNumber, excludeId);
    if (existing) {
      throw new ConflictException('Certificate registration number already exists');
    }
  }

  private async assertUniqueBlank(
    blankSeries: string | null | undefined,
    blankNumber: string | null | undefined,
    excludeId?: string,
  ): Promise<void> {
    const series = blankSeries?.trim();
    const number = blankNumber?.trim();
    if (!series || !number) {
      return;
    }

    const existing = await this.repository.findByBlankSeriesAndNumber(series, number, excludeId);
    if (existing) {
      throw new ConflictException('Certificate blank series and number combination already exists');
    }
  }

  private async assertNoActiveCertificate(
    studentId: string,
    courseId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.repository.findActiveByStudentAndCourse(
      studentId,
      courseId,
      excludeId,
    );
    if (existing) {
      throw new ConflictException('An active certificate already exists for this student and course');
    }
  }

  private async assertNoActiveCertificateInTx(
    manager: EntityManager,
    studentId: string,
    courseId: string,
    excludeId?: string,
  ): Promise<void> {
    const certRepo = manager.getRepository(CertificateEntity);
    const where: FindOptionsWhere<CertificateEntity> = {
      studentId,
      courseId,
      status: In(['issued', 'sent']),
    };
    if (excludeId) {
      where.id = Not(excludeId);
    }
    const existing = await certRepo.findOne({ where });
    if (existing) {
      throw new ConflictException('An active certificate already exists for this student and course');
    }
  }
}
