import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { TelegramService } from '../telegram/telegram.service';
import { formatLessonTime } from '../telegram/telegram-messages';
import { StudentEntity } from '../students/entities/student.entity';
import { UserEntity } from '../users/entities/user.entity';
import {
  LESSON_RESCHEDULED,
  LessonRescheduledPayload,
} from './events/lesson.events';

@Injectable()
export class LessonRescheduledNotifier {
  private readonly logger = new Logger(LessonRescheduledNotifier.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  @OnEvent(LESSON_RESCHEDULED)
  async onLessonRescheduled(payload: LessonRescheduledPayload): Promise<void> {
    try {
      if (!payload?.confirmedStudentIds?.length) {
        return;
      }

      for (const studentId of payload.confirmedStudentIds) {
        await this.notifyStudent(studentId, payload);
      }
    } catch (err) {
      this.logger.error(
        `Failed to handle ${LESSON_RESCHEDULED} for lesson ${payload?.lessonId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async notifyStudent(
    studentId: string,
    payload: LessonRescheduledPayload,
  ): Promise<void> {
    const student = await this.students.findOne({ where: { id: studentId } });
    if (!student?.userId) {
      this.logger.warn(
        `Skip lesson.rescheduled notify: student ${studentId} has no user account`,
      );
      return;
    }

    const user = await this.users.findOne({ where: { id: student.userId } });
    const telegramId =
      user?.telegramId?.trim() || student.telegramId?.trim() || '';

    const previousDate = payload.previous.date || '—';
    const previousTime = formatLessonTime(payload.previous.startTime);
    const nextDate = payload.next.date || '—';
    const nextTime = formatLessonTime(payload.next.startTime);
    const lessonUrl = this.buildLessonUrl(payload.lessonId);

    const inAppTitle = 'Время занятия изменено';
    const inAppBody = 'Преподаватель изменил время вашего занятия.';

    await this.notifications.create({
      userId: student.userId,
      channel: 'in_app',
      type: 'lesson_rescheduled',
      title: inAppTitle,
      body: inAppBody,
      status: 'sent',
      referenceType: 'lesson',
      referenceId: payload.lessonId,
    });

    if (!telegramId) {
      return;
    }

    const telegramBody = [
      '📅 Время вашего занятия изменилось.',
      '',
      'Было:',
      previousDate,
      previousTime,
      '',
      'Стало:',
      nextDate,
      nextTime,
      '',
      'Если новое время вам неудобно, пожалуйста, свяжитесь с преподавателем или администрацией.',
    ].join('\n');

    const sent = await this.telegram.sendMessage(telegramId, telegramBody, {
      replyMarkup: {
        inline_keyboard: [[{ text: 'Открыть занятие', url: lessonUrl }]],
      },
    });

    await this.notifications.create({
      userId: student.userId,
      channel: 'telegram',
      type: 'lesson_rescheduled',
      title: inAppTitle,
      body: telegramBody,
      status: sent.ok ? 'sent' : 'failed',
      referenceType: 'lesson',
      referenceId: payload.lessonId,
    });
  }

  private buildLessonUrl(lessonId: string): string {
    const base =
      this.config.get<string>('appPublicUrl')?.replace(/\/$/, '') ??
      'http://localhost:5173';
    return `${base}/StudentLessons?lesson=${encodeURIComponent(lessonId)}`;
  }
}
