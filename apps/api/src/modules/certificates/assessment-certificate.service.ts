import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  ASSESSMENT_RESULT_INVALIDATED,
  ASSESSMENT_RESULT_PASSED,
} from '../assessment/events/assessment-result.events';
import { AssessmentAttemptEntity } from '../assessment/entities/assessment-attempt.entity';
import { AssessmentExamAssignmentEntity } from '../assessment/entities/assessment-exam-assignment.entity';
import { AssessmentExamEntity } from '../assessment/entities/assessment-exam.entity';
import { AssessmentResultEntity } from '../assessment/entities/assessment-result.entity';
import { AssignmentTargetType, ResultStatus } from '../assessment/enums';
import { EnrollmentEntity } from '../courses/entities/enrollment.entity';
import { CourseTemplateEntity } from '../courses/entities/course-template.entity';
import { CertificateIssuedNotifier } from './certificate-issued-notifier.service';
import { CertificateEntity } from './entities/certificate.entity';
import { CertificateHistoryEntity } from './entities/certificate-history.entity';
import { CertificatesRepository } from './certificates.repository';

const ASSESSMENT_BLANK_SERIES = 'LH-A';

/**
 * Integrates Assessment Result (passed) → CRM Certificate issuance.
 * Does not alter Assessment scoring, lifecycle rules, or ACL.
 */
@Injectable()
export class AssessmentCertificateService {
  private readonly logger = new Logger(AssessmentCertificateService.name);

  constructor(
    private readonly certificates: CertificatesRepository,
    private readonly issuedNotifier: CertificateIssuedNotifier,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(AssessmentResultEntity)
    private readonly resultsRepo: Repository<AssessmentResultEntity>,
    @InjectRepository(AssessmentAttemptEntity)
    private readonly attemptsRepo: Repository<AssessmentAttemptEntity>,
    @InjectRepository(AssessmentExamAssignmentEntity)
    private readonly assignmentsRepo: Repository<AssessmentExamAssignmentEntity>,
    @InjectRepository(AssessmentExamEntity)
    private readonly examsRepo: Repository<AssessmentExamEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentsRepo: Repository<EnrollmentEntity>,
    @InjectRepository(CourseTemplateEntity)
    private readonly coursesRepo: Repository<CourseTemplateEntity>,
  ) {}

  @OnEvent(ASSESSMENT_RESULT_PASSED)
  async onResultPassed(result: AssessmentResultEntity): Promise<void> {
    try {
      await this.issueForPassedResult(result);
    } catch (err) {
      this.logger.error(
        `Failed to issue certificate for result ${result?.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @OnEvent(ASSESSMENT_RESULT_INVALIDATED)
  async onResultInvalidated(payload: { id: string } | AssessmentResultEntity): Promise<void> {
    try {
      await this.revokeForInvalidatedResult(payload.id);
    } catch (err) {
      this.logger.error(
        `Failed to revoke certificate for invalidated result ${payload?.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Create (or reuse) an issued CRM Certificate for a passed Assessment Result.
   * Idempotent: one Result → at most one Certificate.
   */
  async issueForPassedResult(
    resultInput: AssessmentResultEntity | string,
  ): Promise<CertificateEntity | null> {
    const result =
      typeof resultInput === 'string'
        ? await this.resultsRepo.findOne({ where: { id: resultInput } })
        : resultInput;

    if (!result) {
      this.logger.warn('issueForPassedResult: result not found');
      return null;
    }

    if (result.status !== ResultStatus.Passed && result.passed !== true) {
      this.logger.debug(
        `Skip certificate: result ${result.id} status=${result.status} passed=${result.passed}`,
      );
      return null;
    }

    const existing = await this.certificates.findByAssessmentResultId(result.id);
    if (existing) {
      return existing;
    }

    const attempt = await this.attemptsRepo.findOne({ where: { id: result.attemptId } });
    if (!attempt?.studentId) {
      this.logger.warn(
        `Skip certificate: result ${result.id} attempt has no studentId`,
      );
      return null;
    }

    const courseId = await this.resolveCourseId(attempt);
    if (!courseId) {
      this.logger.warn(
        `Skip certificate: no course_id for result ${result.id} (assignment/enrollment)`,
      );
      return null;
    }

    const course = await this.coursesRepo.findOne({ where: { id: courseId } });
    if (!course) {
      this.logger.warn(`Skip certificate: course ${courseId} not found`);
      return null;
    }

    const active = await this.certificates.findActiveByStudentAndCourse(
      attempt.studentId,
      courseId,
    );
    if (active) {
      if (active.assessmentResultId === result.id) {
        return active;
      }
      this.logger.warn(
        `Skip certificate: active certificate ${active.id} already exists for student ${attempt.studentId} course ${courseId}`,
      );
      return null;
    }

    const issueDate = this.toIssueDate(result.finishedAt ?? new Date());
    const registrationNumber = this.buildRegistrationNumber(result.id);
    const blankNumber = await this.nextBlankNumber();

    const saved = await this.dataSource.transaction(async (manager) => {
      const certRepo = manager.getRepository(CertificateEntity);
      // Re-check inside TX for race safety
      const raced = await certRepo.findOne({
        where: { assessmentResultId: result.id },
      });
      if (raced) {
        return raced;
      }

      const created = await certRepo.save(
        certRepo.create({
          studentId: attempt.studentId,
          courseId,
          registrationNumber,
          blankSeries: ASSESSMENT_BLANK_SERIES,
          blankNumber,
          issueDate,
          status: 'issued',
          source: 'assessment',
          assessmentResultId: result.id,
        }),
      );

      await manager.getRepository(CertificateHistoryEntity).save({
        certificateId: created.id,
        action: 'issued',
        newStatus: 'issued',
        notes: `Auto-issued from Assessment Result ${result.id}`,
      });

      return created;
    });

    this.issuedNotifier.notifyAssessmentIssued(saved, {
      examName: (await this.examsRepo.findOne({ where: { id: result.examId } }))?.name ?? null,
    });

    this.logger.log(
      `Issued certificate ${saved.id} from assessment result ${result.id}`,
    );
    return saved;
  }

  /**
   * When a Result is invalidated, revoke the linked Certificate via CRM lifecycle (status=revoked).
   * Idempotent. Safe if no certificate exists.
   */
  async revokeForInvalidatedResult(resultId: string): Promise<CertificateEntity | null> {
    const certificate = await this.certificates.findByAssessmentResultId(resultId);
    if (!certificate) {
      return null;
    }

    if (certificate.status === 'revoked' || certificate.status === 'duplicate') {
      return certificate;
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      const certRepo = manager.getRepository(CertificateEntity);
      const locked = await certRepo.findOne({
        where: { id: certificate.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.status === 'revoked' || locked.status === 'duplicate') {
        return locked;
      }

      const previousStatus = locked.status;
      locked.status = 'revoked';
      const saved = await certRepo.save(locked);

      await manager.getRepository(CertificateHistoryEntity).save({
        certificateId: saved.id,
        action: 'status_changed',
        previousStatus,
        newStatus: 'revoked',
        notes: `Revoked because Assessment Result ${resultId} was invalidated`,
      });

      return saved;
    });

    return updated ?? null;
  }

  async findByAssessmentResultId(resultId: string): Promise<CertificateEntity | null> {
    return this.certificates.findByAssessmentResultId(resultId);
  }

  private async resolveCourseId(attempt: AssessmentAttemptEntity): Promise<string | null> {
    if (attempt.assignmentId) {
      const assignment = await this.assignmentsRepo.findOne({
        where: { id: attempt.assignmentId },
      });
      if (assignment?.targetType === AssignmentTargetType.Course && assignment.targetId) {
        return assignment.targetId;
      }
    }

    if (!attempt.studentId) {
      return null;
    }

    const enrollments = await this.enrollmentsRepo.find({
      where: {
        studentId: attempt.studentId,
        status: In(['completed', 'active']),
      },
      order: { updatedAt: 'DESC' },
    });

    const withCourse = enrollments.find((e) => e.courseTemplateId);
    return withCourse?.courseTemplateId ?? null;
  }

  private toIssueDate(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private buildRegistrationNumber(resultId: string): string {
    const compact = resultId.replace(/-/g, '').slice(0, 12).toUpperCase();
    return `ASSESS-${compact}`;
  }

  private async nextBlankNumber(): Promise<string> {
    const stamp = Date.now().toString().slice(-8);
    const suffix = Math.floor(Math.random() * 90 + 10).toString();
    let candidate = `${stamp}${suffix}`;
    let guard = 0;
    while (guard < 8) {
      const clash = await this.certificates.findByBlankSeriesAndNumber(
        ASSESSMENT_BLANK_SERIES,
        candidate,
      );
      if (!clash) {
        return candidate;
      }
      candidate = `${stamp}${Math.floor(Math.random() * 900 + 100)}`;
      guard += 1;
    }
    return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
}
