import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobGuard } from '../../common/concurrency/job-guard';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import {
  build24hReminderMessage,
  formatLessonTime,
} from '../telegram/telegram-messages';
import { TelegramGateway } from '../telegram/telegram.gateway';
import { LessonConfirmationService } from './lesson-confirmation.service';

/**
 * Lesson notification jobs:
 * - 24h informational reminder (no LessonConfirmation)
 * - 3h confirmation request (LessonConfirmation)
 */
@Injectable()
export class LessonConfirmationJobsService {
  private readonly logger = new Logger(LessonConfirmationJobsService.name);
  private readonly remind24hGuard = new JobGuard(this.logger, 'sendLessonReminders24h');
  private readonly confirm3hGuard = new JobGuard(this.logger, 'sendLessonConfirmations3h');

  constructor(
    private readonly config: ConfigService,
    private readonly confirmations: LessonConfirmationService,
    private readonly gateway: TelegramGateway,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
  ) {}

  @Cron('*/10 * * * *')
  async sendLessonReminders24h() {
    if (!this.config.get<boolean>('jobs.enabled')) return;
    if (!this.config.get<boolean>('telegram.enabled')) return;

    await this.remind24hGuard.run(async () => {
      const result = await this.runSendLessonReminders24h();
      this.logger.log(
        `send-lesson-reminders-24h: lessons=${result.lessons} sent=${result.sent}`,
      );
    });
  }

  @Cron('*/5 * * * *')
  async sendLessonConfirmations3h() {
    if (!this.config.get<boolean>('jobs.enabled')) return;
    if (!this.config.get<boolean>('telegram.enabled')) return;

    await this.confirm3hGuard.run(async () => {
      const result = await this.runSendPendingLessonConfirmations();
      this.logger.log(
        `send-lesson-confirmations-3h: lessons=${result.lessons} sent=${result.sent} skipped=${result.skipped}`,
      );
    });
  }

  async runSendLessonReminders24h(): Promise<{ lessons: number; sent: number }> {
    const planned = await this.lessonRepo.find({ where: { status: 'planned' } });
    const now = this.getTimezoneNow();
    const windowMin = 23 * 60 + 50;
    const windowMax = 24 * 60 + 10;

    const windowLessons = planned.filter((lesson) => {
      if (lesson.reminder24hSent) return false;
      const start = this.getLessonStartTime(lesson);
      const diffMin = (start.getTime() - now.getTime()) / 60_000;
      return diffMin >= windowMin && diffMin <= windowMax;
    });

    let sent = 0;
    for (const lesson of windowLessons) {
      const teacher = lesson.teacherId
        ? await this.teacherRepo.findOne({ where: { id: lesson.teacherId } })
        : null;
      const course = await this.confirmations.resolveLessonCourseTitle(lesson);
      const studentIds = await this.confirmations.resolveParticipantStudentIds(lesson);

      const text = build24hReminderMessage({
        time: formatLessonTime(lesson.startTime),
        course,
        teacher: teacher?.name?.trim() || '—',
      });

      let delivered = 0;
      for (const studentId of studentIds) {
        const chatId = await this.confirmations.resolveStudentTelegramChatId(
          studentId,
        );
        if (!chatId) {
          this.logger.warn(
            `Skip 24h reminder: student ${studentId} has no telegram_id`,
          );
          continue;
        }

        const notifyEnabled = await this.confirmations.isNotifyEnabledForStudent(
          studentId,
          '24h',
        );
        if (!notifyEnabled) {
          this.logger.warn(
            `Skip 24h reminder: student ${studentId} disabled 24h notifications`,
          );
          continue;
        }

        const result = await this.gateway.sendMessage(chatId, text);
        if (result.ok) {
          sent += 1;
          delivered += 1;
        } else {
          this.logger.error(
            `24h reminder failed for student ${studentId}: ${result.error ?? result.description}`,
          );
        }
      }

      // Mark sent only after at least one successful delivery (or no participants).
      if (studentIds.length === 0 || delivered > 0) {
        lesson.reminder24hSent = true;
        await this.lessonRepo.save(lesson);
      }
    }

    return { lessons: windowLessons.length, sent };
  }

  async runSendPendingLessonConfirmations(): Promise<{
    lessons: number;
    sent: number;
    skipped: number;
  }> {
    const planned = await this.lessonRepo.find({ where: { status: 'planned' } });
    const now = this.getTimezoneNow();
    const windowMin = 2 * 60 + 50;
    const windowMax = 3 * 60 + 10;

    const windowLessons = planned.filter((lesson) => {
      if (lesson.lessonType !== 'individual' || lesson.groupId) {
        return false;
      }
      const start = this.getLessonStartTime(lesson);
      const diffMin = (start.getTime() - now.getTime()) / 60_000;
      return diffMin >= windowMin && diffMin <= windowMax;
    });

    let sent = 0;
    let skipped = 0;

    for (const lesson of windowLessons) {
      const studentIds = await this.confirmations.resolveParticipantStudentIds(lesson);
      for (const studentId of studentIds) {
        const created = await this.confirmations.requestConfirmationForStudent(
          lesson,
          studentId,
        );
        if (created) {
          sent += 1;
        } else {
          skipped += 1;
        }
      }
    }

    return { lessons: windowLessons.length, sent, skipped };
  }

  private getLessonStartTime(lesson: LessonEntity): Date {
    const [year, month, day] = String(lesson.date || '').split('-').map(Number);
    const [hours, minutes] = String(lesson.startTime || '00:00').split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }

  private getTimezoneNow(): Date {
    const tz = this.config.get<string>('jobs.reminderTimezone') ?? 'Europe/Minsk';
    const now = new Date();
    const localized = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const offsetMs = localized.getTime() - now.getTime();
    return new Date(now.getTime() + offsetMs);
  }
}
