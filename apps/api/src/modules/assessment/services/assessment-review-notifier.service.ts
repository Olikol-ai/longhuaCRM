import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../../notifications/notifications.service';
import { TelegramService } from '../../telegram/telegram.service';
import { StudentEntity } from '../../students/entities/student.entity';
import { TeacherEntity } from '../../teachers/entities/teacher.entity';
import { formatStudentProfileDisplayName } from '../../users/display-name.util';
import { UserEntity } from '../../users/entities/user.entity';
import { AssessmentExamEntity } from '../entities/assessment-exam.entity';
import { AssessmentResultEntity } from '../entities/assessment-result.entity';
import {
  ASSESSMENT_RESULT_PENDING_REVIEW,
  ASSESSMENT_RESULT_REVIEWED,
} from '../events/assessment-result.events';
import { QuestionType, ResultStatus } from '../enums';
import { AssessmentAttemptRepository } from '../repositories';

/**
 * Notifies teachers about pending review and students after review is finalized.
 */
@Injectable()
export class AssessmentReviewNotifier {
  private readonly logger = new Logger(AssessmentReviewNotifier.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
    private readonly attemptsRepo: AssessmentAttemptRepository,
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teachers: Repository<TeacherEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(AssessmentExamEntity)
    private readonly exams: Repository<AssessmentExamEntity>,
  ) {}

  @OnEvent(ASSESSMENT_RESULT_PENDING_REVIEW)
  async onPendingReview(result: AssessmentResultEntity): Promise<void> {
    try {
      if (result.status !== ResultStatus.PendingReview) {
        return;
      }
      await this.notifyTeacher(result);
    } catch (err) {
      this.logger.error(
        `Failed to notify teacher about pending review ${result?.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  @OnEvent(ASSESSMENT_RESULT_REVIEWED)
  async onReviewed(result: AssessmentResultEntity): Promise<void> {
    try {
      await this.notifyStudentReviewed(result);
    } catch (err) {
      this.logger.error(
        `Failed to notify student about reviewed result ${result?.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async notifyStudentReviewed(
    result: AssessmentResultEntity,
  ): Promise<void> {
    const attempt = await this.attemptsRepo.findById(result.attemptId);
    if (!attempt?.userId && !attempt?.studentId) {
      return;
    }

    let userId = attempt.userId;
    let telegramId = '';

    if (attempt.studentId) {
      const student = await this.students.findOne({
        where: { id: attempt.studentId },
      });
      if (student?.userId) {
        userId = student.userId;
      }
      telegramId = student?.telegramId?.trim() || '';
    }

    if (!userId) {
      return;
    }

    const user = await this.users.findOne({ where: { id: userId } });
    if (!telegramId) {
      telegramId = user?.telegramId?.trim() || '';
    }

    const exam = await this.exams.findOne({ where: { id: result.examId } });
    const examName = exam?.name?.trim() || 'Экзамен';
    const outcome =
      result.status === ResultStatus.Passed || result.passed
        ? 'сдан'
        : 'не сдан';

    const title = 'Ваш экзамен проверен.';
    const body = [
      `Экзамен: ${examName}`,
      `Итог: ${outcome}`,
      result.percent != null ? `Результат: ${result.percent}%` : null,
    ]
      .filter(Boolean)
      .join('\n');

    await this.notifications.create({
      userId,
      channel: 'in_app',
      type: 'assessment_reviewed',
      title,
      body,
      status: 'pending',
      referenceType: 'assessment_result',
      referenceId: result.id,
    });

    if (telegramId) {
      const sent = await this.telegram.sendMessage(
        telegramId,
        `${title}\n\n${body}`,
      );
      await this.notifications.create({
        userId,
        channel: 'telegram',
        type: 'assessment_reviewed',
        title,
        body,
        status: sent.ok ? 'sent' : 'failed',
        referenceType: 'assessment_result',
        referenceId: result.id,
      });
    }
  }

  private async notifyTeacher(result: AssessmentResultEntity): Promise<void> {
    const attempt = await this.attemptsRepo.findById(result.attemptId);
    if (!attempt?.studentId) {
      return;
    }

    const student = await this.students.findOne({
      where: { id: attempt.studentId },
    });
    if (!student?.assignedTeacherId) {
      this.logger.debug(
        `No assigned teacher for student ${attempt.studentId}; skip review notify`,
      );
      return;
    }

    const teacher = await this.teachers.findOne({
      where: { id: student.assignedTeacherId },
    });
    if (!teacher?.userId) {
      return;
    }

    const teacherUser = await this.users.findOne({ where: { id: teacher.userId } });
    const telegramId =
      teacherUser?.telegramId?.trim() || teacher.telegramId?.trim() || '';

    const exam = await this.exams.findOne({ where: { id: result.examId } });
    const examName = exam?.name?.trim() || 'Экзамен';
    const studentName = formatStudentProfileDisplayName(student) || 'Ученик';

    const manualCount = await this.countManualQuestions(attempt.id);
    const reviewUrl = this.buildReviewUrl(result.id);

    const title = 'Новая работа на проверку';
    const body = [
      `Ученик: ${studentName}`,
      `Экзамен: ${examName}`,
      manualCount > 0
        ? `Вопросов на ручную проверку: ${manualCount}`
        : 'Требуется ручная проверка результата',
      '',
      'Откройте раздел «Работы на проверку».',
    ].join('\n');

    await this.notifications.create({
      userId: teacher.userId,
      channel: 'in_app',
      type: 'assessment_pending_review',
      title,
      body,
      status: 'pending',
      referenceType: 'assessment_result',
      referenceId: result.id,
    });

    if (telegramId) {
      const sent = await this.telegram.sendMessage(
        telegramId,
        `${title}\n\n${body}`,
        {
          replyMarkup: {
            inline_keyboard: [[{ text: 'Открыть работу', url: reviewUrl }]],
          },
        },
      );
      await this.notifications.create({
        userId: teacher.userId,
        channel: 'telegram',
        type: 'assessment_pending_review',
        title,
        body,
        status: sent.ok ? 'sent' : 'failed',
        referenceType: 'assessment_result',
        referenceId: result.id,
      });
    }
  }

  private async countManualQuestions(attemptId: string): Promise<number> {
    const snaps =
      await this.attemptsRepo.findQuestionSnapshotsByAttemptId(attemptId);
    return snaps.filter((q) => q.type === QuestionType.ShortText).length;
  }

  private buildReviewUrl(resultId: string): string {
    const base =
      this.config.get<string>('appPublicUrl')?.replace(/\/$/, '') ??
      `http://localhost:${this.config.get<number>('port') ?? 3001}`;
    return `${base}/TeacherAssessmentReviewDetail?id=${encodeURIComponent(resultId)}`;
  }
}
