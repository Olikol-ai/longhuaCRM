import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { TelegramService } from '../telegram/telegram.service';
import { StudentEntity } from '../students/entities/student.entity';
import { UserEntity } from '../users/entities/user.entity';
import {
  LESSON_UPDATED,
  LessonUpdatedPayload,
} from './events/lesson.events';

@Injectable()
export class LessonUpdatedNotifier {
  private readonly logger = new Logger(LessonUpdatedNotifier.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  @OnEvent(LESSON_UPDATED)
  async onLessonUpdated(payload: LessonUpdatedPayload): Promise<void> {
    try {
      if (!payload?.studentIds?.length || !payload.changedFields?.length) {
        return;
      }

      for (const studentId of payload.studentIds) {
        await this.notifyStudent(studentId, payload);
      }
    } catch (err) {
      this.logger.error(
        `Failed to handle ${LESSON_UPDATED} for lesson ${payload?.lessonId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async notifyStudent(
    studentId: string,
    payload: LessonUpdatedPayload,
  ): Promise<void> {
    const student = await this.students.findOne({ where: { id: studentId } });
    if (!student?.userId) {
      this.logger.warn(
        `Skip lesson.updated notify: student ${studentId} has no user account`,
      );
      return;
    }

    const user = await this.users.findOne({ where: { id: student.userId } });
    const telegramId =
      user?.telegramId?.trim() || student.telegramId?.trim() || '';

    const changedLabels = payload.changedFields.map((field) => field.label);
    const lessonUrl = this.buildLessonUrl(payload.lessonId);

    const inAppTitle = 'Информация о занятии обновлена';
    const inAppBody = 'Преподаватель обновил информацию о занятии.';

    await this.notifications.create({
      userId: student.userId,
      channel: 'in_app',
      type: 'lesson_updated',
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
      'ℹ️ Информация о занятии обновлена.',
      '',
      'Изменены:',
      ...changedLabels.map((label) => `• ${label}`),
    ].join('\n');

    const sent = await this.telegram.sendMessage(telegramId, telegramBody, {
      replyMarkup: {
        inline_keyboard: [[{ text: 'Открыть занятие', url: lessonUrl }]],
      },
    });

    await this.notifications.create({
      userId: student.userId,
      channel: 'telegram',
      type: 'lesson_updated',
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
