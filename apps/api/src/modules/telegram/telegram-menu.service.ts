import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LessonConfirmationService } from '../lesson-confirmations/lesson-confirmation.service';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { UserEntity } from '../users/entities/user.entity';
import { formatStudentProfileDisplayName } from '../users/display-name.util';
import { UsersRepository } from '../users/users.repository';
import {
  backInlineKeyboard,
  buildBalanceText,
  buildConnectionStatusText,
  buildNearestLessonCard,
  buildNotificationSettingsText,
  formatLessonTime,
  mainMenuInlineKeyboard,
  replyKeyboardRemove,
  settingsInlineKeyboard,
  TELEGRAM_MSG,
} from './telegram-messages';
import {
  TelegramApiResult,
  TelegramGateway,
  TelegramSendMessageOptions,
} from './telegram.gateway';

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
    const teacherProfile = await this.teacherRepo.findOne({
      where: { userId: user.id },
    });
    const isTeacherAudience = Boolean(
      teacherProfile && lesson.teacherId === teacherProfile.id,
    );

    let counterpartName = '—';
    if (isTeacherAudience) {
      counterpartName = await this.resolveLessonStudentNames(lesson);
    } else {
      const teacher = lesson.teacherId
        ? await this.teacherRepo.findOne({ where: { id: lesson.teacherId } })
        : null;
      counterpartName = teacher?.name?.trim() || '—';
    }

    return {
      text: buildNearestLessonCard({
        course,
        whenLabel: this.formatWhenLabel(lesson),
        audience: isTeacherAudience ? 'teacher' : 'student',
        counterpartName,
        room: lesson.room,
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

  async buildProfileScreen(chatId: string): Promise<TelegramScreenPayload> {
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

  /**
   * Reads students.lesson_balance — the same field used by StudentDashboard / payments.
   * Does not recalculate balance.
   */
  async buildBalanceScreen(chatId: string): Promise<TelegramScreenPayload> {
    const user = await this.resolveUserByChatId(chatId);
    if (!user) {
      return {
        text: TELEGRAM_MSG.notLinkedShort,
        options: { replyMarkup: backInlineKeyboard() },
      };
    }

    const student = await this.studentRepo.findOne({ where: { userId: user.id } });
    if (!student) {
      return {
        text: TELEGRAM_MSG.balanceNotStudent,
        options: { replyMarkup: backInlineKeyboard() },
      };
    }

    const tz = this.config.get<string>('jobs.reminderTimezone') ?? 'Europe/Minsk';
    const updatedAtLabel = student.updatedAt
      ? student.updatedAt.toLocaleDateString('ru-RU', {
          timeZone: tz,
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : null;

    return {
      text: buildBalanceText({
        lessonBalance: student.lessonBalance ?? 0,
        updatedAtLabel,
      }),
      options: { replyMarkup: backInlineKeyboard() },
    };
  }

  async buildStatusScreen(chatId: string): Promise<TelegramScreenPayload> {
    return this.buildProfileScreen(chatId);
  }

  buildHelpScreen(): TelegramScreenPayload {
    return {
      text: TELEGRAM_MSG.help,
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

  /**
   * Sticky ReplyKeyboard from older bot builds stays on the client until
   * ReplyKeyboardRemove is received. It cannot be combined with inline_keyboard,
   * and messages sent with remove_keyboard cannot be edited — so we:
   * 1) pulse remove_keyboard on a throwaway message
   * 2) delete that message
   * 3) send the real inline screen
   */
  async clearStickyReplyKeyboard(chatId: string): Promise<void> {
    const sent = await this.gateway.sendMessage(chatId, '·', {
      replyMarkup: replyKeyboardRemove(),
    });
    if (!sent.ok) {
      this.logger.warn(
        `remove_keyboard failed for ${chatId}: ${sent.error ?? sent.description}`,
      );
      return;
    }
    const messageId = this.extractMessageId(sent);
    if (messageId == null) {
      return;
    }
    const deleted = await this.gateway.deleteMessage(chatId, messageId);
    if (!deleted.ok) {
      this.logger.warn(
        `deleteMessage after remove_keyboard failed for ${chatId}: ${deleted.error ?? deleted.description}`,
      );
    }
  }

  async sendScreenRemovingReplyKeyboard(
    chatId: string,
    screen: TelegramScreenPayload,
  ): Promise<void> {
    await this.clearStickyReplyKeyboard(chatId);
    await this.sendScreen(chatId, screen);
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

  private extractMessageId(result: TelegramApiResult): number | null {
    const raw = result.result;
    if (!raw || typeof raw !== 'object') return null;
    const id = (raw as { message_id?: unknown }).message_id;
    return typeof id === 'number' ? id : null;
  }

  /** Display names of lesson participants for teacher-facing Telegram copy. */
  private async resolveLessonStudentNames(lesson: LessonEntity): Promise<string> {
    const studentIds =
      await this.confirmations.resolveParticipantStudentIds(lesson);
    if (studentIds.length === 0) {
      return '—';
    }

    const students = await this.studentRepo.find({
      where: { id: In(studentIds) },
    });
    const byId = new Map(
      students.map((s) => [s.id, formatStudentProfileDisplayName(s)] as const),
    );
    const names = studentIds
      .map((id) => byId.get(id) || '')
      .filter((name) => name.length > 0);

    return names.length > 0 ? names.join('\n') : '—';
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
