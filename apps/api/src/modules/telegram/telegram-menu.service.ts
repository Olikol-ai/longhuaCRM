import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonConfirmationService } from '../lesson-confirmations/lesson-confirmation.service';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { UserEntity } from '../users/entities/user.entity';
import { UsersRepository } from '../users/users.repository';
import {
  backInlineKeyboard,
  buildConnectionStatusText,
  buildNearestLessonCard,
  buildNotificationSettingsText,
  formatLessonTime,
  mainMenuInlineKeyboard,
  settingsInlineKeyboard,
  TELEGRAM_MSG,
} from './telegram-messages';
import { TelegramGateway, TelegramSendMessageOptions } from './telegram.gateway';

export type TelegramScreenPayload = {
  text: string;
  options?: TelegramSendMessageOptions;
};

@Injectable()
export class TelegramMenuService {
  private readonly logger = new Logger(TelegramMenuService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly usersRepository: UsersRepository,
    private readonly confirmations: LessonConfirmationService,
    private readonly gateway: TelegramGateway,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async resolveUserByChatId(chatId: string): Promise<UserEntity | null> {
    return this.usersRepository.findByTelegramId(String(chatId).trim());
  }

  /** Inline menu used for /start and «Назад». */
  buildMainMenuInlineScreen(): TelegramScreenPayload {
    return {
      text: TELEGRAM_MSG.startLinked,
      options: { replyMarkup: mainMenuInlineKeyboard() },
    };
  }

  async buildLessonsScreen(chatId: string): Promise<TelegramScreenPayload> {
    const user = await this.resolveUserByChatId(chatId);
    if (!user) {
      return {
        text: TELEGRAM_MSG.notLinkedShort,
        options: { replyMarkup: backInlineKeyboard() },
      };
    }

    const lesson = await this.findNearestLessonForUser(user);
    if (!lesson) {
      return {
        text: TELEGRAM_MSG.noUpcomingLessons,
        options: { replyMarkup: backInlineKeyboard() },
      };
    }

    const course = await this.confirmations.resolveLessonCourseTitle(lesson);
    const teacher = lesson.teacherId
      ? await this.teacherRepo.findOne({ where: { id: lesson.teacherId } })
      : null;

    return {
      text: buildNearestLessonCard({
        course,
        whenLabel: this.formatWhenLabel(lesson),
        teacher: teacher?.name?.trim() || '—',
      }),
      options: { replyMarkup: backInlineKeyboard() },
    };
  }

  async buildSettingsScreen(chatId: string): Promise<TelegramScreenPayload> {
    const user = await this.resolveUserByChatId(chatId);
    if (!user) {
      return {
        text: TELEGRAM_MSG.notLinkedShort,
        options: { replyMarkup: backInlineKeyboard() },
      };
    }

    const prefs = {
      notify24h: user.telegramNotify24h !== false,
      notify3h: user.telegramNotify3h !== false,
    };

    return {
      text: buildNotificationSettingsText(prefs),
      options: { replyMarkup: settingsInlineKeyboard(prefs) },
    };
  }

  async buildStatusScreen(chatId: string): Promise<TelegramScreenPayload> {
    const user = await this.resolveUserByChatId(chatId);
    if (!user) {
      return {
        text: buildConnectionStatusText({
          connected: false,
          username: null,
          connectedAt: null,
        }),
        options: { replyMarkup: backInlineKeyboard() },
      };
    }

    return {
      text: buildConnectionStatusText({
        connected: true,
        username: user.telegramUsername?.trim() || null,
        connectedAt: user.telegramConnectedAt
          ? user.telegramConnectedAt.toLocaleString('ru-RU', {
              timeZone:
                this.config.get<string>('jobs.reminderTimezone') ?? 'Europe/Minsk',
            })
          : null,
      }),
      options: { replyMarkup: backInlineKeyboard() },
    };
  }

  async toggleNotifyPreference(
    chatId: string,
    kind: '24h' | '3h',
  ): Promise<TelegramScreenPayload> {
    const user = await this.resolveUserByChatId(chatId);
    if (!user) {
      return {
        text: TELEGRAM_MSG.notLinkedShort,
        options: { replyMarkup: backInlineKeyboard() },
      };
    }

    if (kind === '24h') {
      user.telegramNotify24h = !(user.telegramNotify24h !== false);
    } else {
      user.telegramNotify3h = !(user.telegramNotify3h !== false);
    }
    user.updatedDate = new Date();
    await this.userRepo.save(user);

    return this.buildSettingsScreen(chatId);
  }

  async sendScreen(chatId: string, screen: TelegramScreenPayload): Promise<void> {
    await this.gateway.sendMessage(chatId, screen.text, screen.options);
  }

  async editOrSendScreen(
    chatId: string,
    messageId: number | null,
    screen: TelegramScreenPayload,
  ): Promise<void> {
    if (messageId != null && screen.options?.replyMarkup
      && 'inline_keyboard' in screen.options.replyMarkup) {
      const edited = await this.gateway.editMessageText(
        chatId,
        messageId,
        screen.text,
        screen.options,
      );
      if (edited.ok) {
        return;
      }
      this.logger.warn(
        `editMessageText failed for ${chatId}: ${edited.error ?? edited.description}`,
      );
    }
    await this.sendScreen(chatId, screen);
  }

  private async findNearestLessonForUser(
    user: UserEntity,
  ): Promise<LessonEntity | null> {
    const now = Date.now();
    const planned = await this.lessonRepo.find({
      where: { status: 'planned' },
      order: { date: 'ASC', startTime: 'ASC' },
      take: 300,
    });

    const student = await this.studentRepo.findOne({ where: { userId: user.id } });
    const teacher = await this.teacherRepo.findOne({ where: { userId: user.id } });

    for (const lesson of planned) {
      const startMs = this.getLessonStartMs(lesson);
      if (startMs < now) continue;

      if (teacher && lesson.teacherId === teacher.id) {
        return lesson;
      }

      if (student) {
        const participants =
          await this.confirmations.resolveParticipantStudentIds(lesson);
        if (participants.includes(student.id)) {
          return lesson;
        }
      }
    }

    return null;
  }

  private formatWhenLabel(lesson: LessonEntity): string {
    const time = formatLessonTime(lesson.startTime);
    const tz = this.config.get<string>('jobs.reminderTimezone') ?? 'Europe/Minsk';
    const today = this.formatDateInTz(new Date(), tz);
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = this.formatDateInTz(tomorrowDate, tz);
    const lessonDate = String(lesson.date || '');

    if (lessonDate === today) {
      return `Сегодня ${time}`;
    }
    if (lessonDate === tomorrow) {
      return `Завтра ${time}`;
    }

    const [year, month, day] = lessonDate.split('-');
    if (year && month && day) {
      return `${day}.${month} ${time}`;
    }
    return `${lessonDate} ${time}`;
  }

  private formatDateInTz(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value ?? '0000';
    const month = parts.find((p) => p.type === 'month')?.value ?? '01';
    const day = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
  }

  private getLessonStartMs(lesson: LessonEntity): number {
    const [year, month, day] = String(lesson.date || '').split('-').map(Number);
    const [hours, minutes] = String(lesson.startTime || '00:00')
      .split(':')
      .map(Number);
    return new Date(year, month - 1, day, hours, minutes).getTime();
  }
}
