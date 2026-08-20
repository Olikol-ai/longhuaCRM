import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { JobGuard } from '../../common/concurrency/job-guard';
import { GroupEntity } from '../groups/entities/group.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherStudentContactEntity } from '../teacher-student-contacts/entities/teacher-student-contact.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import {
  buildTeacherTomorrowDigestMessage,
  getSchoolTomorrowDateYmd,
  type TomorrowDigestLessonLine,
} from '../telegram/telegram-messages';
import { TelegramGateway } from '../telegram/telegram.gateway';
import { TutorStudentEntity } from '../tutors/entities/tutor-student.entity';
import { TutorEntity } from '../tutors/entities/tutor.entity';
import { formatStudentProfileDisplayName } from '../users/display-name.util';
import { UserEntity } from '../users/entities/user.entity';
import {
  InstructorScheduleDigestEntity,
  type InstructorScheduleDigestKind,
} from './entities/instructor-schedule-digest.entity';
import { LessonConfirmationService } from './lesson-confirmation.service';

const DIGEST_CRON_TIMEZONE =
  process.env.REMINDER_TIMEZONE?.trim() || 'Europe/Minsk';

export type TomorrowDigestPreview = {
  kind: InstructorScheduleDigestKind;
  recipientId: string;
  chatId: string | null;
  lessonCount: number;
  text: string;
};

export type TomorrowDigestRunOptions = {
  /**
   * Build messages and validate the DB→recipient→text chain without
   * claiming idempotency slots or calling Telegram sendMessage.
   */
  dryRun?: boolean;
  /**
   * When set (and dryRun is false), redirect every send to this chat
   * and prefix the message with a [TEST] marker. Does not claim digest slots,
   * so production cron remains unaffected.
   */
  redirectChatId?: string | null;
};

export type TomorrowDigestRunResult = {
  scheduleDate: string;
  recipients: number;
  sent: number;
  skippedNoTelegram: number;
  skippedDuplicate: number;
  skippedEmpty: number;
  errors: number;
  dryRun: boolean;
  redirected: boolean;
  previews: TomorrowDigestPreview[];
};

/**
 * Daily 19:00 (school TZ) Telegram digest of tomorrow's planned lessons
 * for teachers and tutors with a linked Telegram chat.
 */
@Injectable()
export class TeacherTomorrowDigestJobsService {
  private readonly logger = new Logger(TeacherTomorrowDigestJobsService.name);
  private readonly guard = new JobGuard(this.logger, 'sendTeacherTomorrowDigests');

  constructor(
    private readonly config: ConfigService,
    private readonly gateway: TelegramGateway,
    private readonly confirmations: LessonConfirmationService,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @InjectRepository(TeacherEntity)
    private readonly teacherRepo: Repository<TeacherEntity>,
    @InjectRepository(TutorEntity)
    private readonly tutorRepo: Repository<TutorEntity>,
    @InjectRepository(StudentEntity)
    private readonly studentRepo: Repository<StudentEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepo: Repository<GroupEntity>,
    @InjectRepository(TeacherStudentContactEntity)
    private readonly contactRepo: Repository<TeacherStudentContactEntity>,
    @InjectRepository(TutorStudentEntity)
    private readonly tutorStudentRepo: Repository<TutorStudentEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(InstructorScheduleDigestEntity)
    private readonly digestRepo: Repository<InstructorScheduleDigestEntity>,
  ) {}

  @Cron('0 19 * * *', { timeZone: DIGEST_CRON_TIMEZONE })
  async sendTeacherTomorrowDigestsCron(): Promise<void> {
    if (!this.config.get<boolean>('jobs.enabled')) return;
    if (!this.config.get<boolean>('telegram.enabled')) return;

    await this.guard.run(async () => {
      const result = await this.runSendTeacherTomorrowDigests();
      this.logger.log(
        `teacher-tomorrow-digest date=${result.scheduleDate} `
          + `recipients=${result.recipients} sent=${result.sent} `
          + `dup=${result.skippedDuplicate} noTg=${result.skippedNoTelegram} `
          + `empty=${result.skippedEmpty} errors=${result.errors}`,
      );
    });
  }

  /** Manual / test entry — does not wait for the cron tick. */
  async runSendTeacherTomorrowDigests(
    now: Date = new Date(),
    options: TomorrowDigestRunOptions = {},
  ): Promise<TomorrowDigestRunResult> {
    const dryRun = options.dryRun === true;
    const redirectChatId = (options.redirectChatId ?? '').trim() || null;
    const tz =
      this.config.get<string>('jobs.reminderTimezone') ?? 'Europe/Minsk';
    const scheduleDate = getSchoolTomorrowDateYmd(tz, now);

    const lessons = await this.lessonRepo.find({
      where: { date: scheduleDate, status: 'planned' },
      order: { startTime: 'ASC' },
    });

    const byTeacher = new Map<string, LessonEntity[]>();
    const byTutor = new Map<string, LessonEntity[]>();
    for (const lesson of lessons) {
      if (lesson.teacherId) {
        const list = byTeacher.get(lesson.teacherId) ?? [];
        list.push(lesson);
        byTeacher.set(lesson.teacherId, list);
      }
      if (lesson.tutorId) {
        const list = byTutor.get(lesson.tutorId) ?? [];
        list.push(lesson);
        byTutor.set(lesson.tutorId, list);
      }
    }

    const result: TomorrowDigestRunResult = {
      scheduleDate,
      recipients: byTeacher.size + byTutor.size,
      sent: 0,
      skippedNoTelegram: 0,
      skippedDuplicate: 0,
      skippedEmpty: 0,
      errors: 0,
      dryRun,
      redirected: Boolean(redirectChatId) && !dryRun,
      previews: [],
    };

    for (const [teacherId, teacherLessons] of byTeacher) {
      const outcome = await this.sendDigestForRecipient({
        kind: 'teacher',
        recipientId: teacherId,
        scheduleDate,
        lessons: teacherLessons,
        timeZone: tz,
        dryRun,
        redirectChatId,
        previews: result.previews,
      });
      this.applyOutcome(result, outcome);
    }

    for (const [tutorId, tutorLessons] of byTutor) {
      const outcome = await this.sendDigestForRecipient({
        kind: 'tutor',
        recipientId: tutorId,
        scheduleDate,
        lessons: tutorLessons,
        timeZone: tz,
        dryRun,
        redirectChatId,
        previews: result.previews,
      });
      this.applyOutcome(result, outcome);
    }

    return result;
  }

  private applyOutcome(
    result: TomorrowDigestRunResult,
    outcome: 'sent' | 'duplicate' | 'no_telegram' | 'empty' | 'error',
  ): void {
    if (outcome === 'sent') result.sent += 1;
    else if (outcome === 'duplicate') result.skippedDuplicate += 1;
    else if (outcome === 'no_telegram') result.skippedNoTelegram += 1;
    else if (outcome === 'empty') result.skippedEmpty += 1;
    else result.errors += 1;
  }

  private async sendDigestForRecipient(input: {
    kind: InstructorScheduleDigestKind;
    recipientId: string;
    scheduleDate: string;
    lessons: LessonEntity[];
    timeZone: string;
    dryRun?: boolean;
    redirectChatId?: string | null;
    previews: TomorrowDigestPreview[];
  }): Promise<'sent' | 'duplicate' | 'no_telegram' | 'empty' | 'error'> {
    const sorted = [...input.lessons].sort((a, b) =>
      String(a.startTime).localeCompare(String(b.startTime)),
    );
    if (sorted.length === 0) {
      return 'empty';
    }

    const resolvedChatId = await this.resolveRecipientChatId(
      input.kind,
      input.recipientId,
    );
    const redirectChatId = (input.redirectChatId ?? '').trim() || null;
    const chatId = redirectChatId || resolvedChatId;

    const lines: TomorrowDigestLessonLine[] = [];
    for (const lesson of sorted) {
      lines.push({
        startTime: lesson.startTime,
        participantLabel: await this.resolveParticipantLabel(lesson),
        lessonFormat: lesson.lessonFormat,
      });
    }

    let text = buildTeacherTomorrowDigestMessage({
      scheduleDateYmd: input.scheduleDate,
      lessons: lines,
      timeZone: input.timeZone,
    });
    if (redirectChatId) {
      text =
        `[TEST] Сводка для ${input.kind} ${input.recipientId}\n\n` + text;
    }

    input.previews.push({
      kind: input.kind,
      recipientId: input.recipientId,
      chatId: chatId || null,
      lessonCount: sorted.length,
      text,
    });

    if (input.dryRun) {
      return chatId || resolvedChatId ? 'sent' : 'no_telegram';
    }

    if (!chatId) {
      this.logger.warn(
        `Skip tomorrow digest: ${input.kind} ${input.recipientId} has no telegram`,
      );
      return 'no_telegram';
    }

    // Redirected test sends must not consume production idempotency slots.
    const useClaim = !redirectChatId;
    if (useClaim) {
      const claimed = await this.claimDigestSlot(
        input.kind,
        input.recipientId,
        input.scheduleDate,
        sorted.length,
      );
      if (!claimed) {
        return 'duplicate';
      }
    }

    try {
      const sendResult = await this.gateway.sendMessage(chatId, text);
      if (!sendResult?.ok) {
        const detail =
          sendResult?.description || sendResult?.error || 'unknown telegram error';
        throw new Error(String(detail));
      }
      return 'sent';
    } catch (error) {
      if (useClaim) {
        await this.releaseDigestSlot(
          input.kind,
          input.recipientId,
          input.scheduleDate,
        );
      }
      this.logger.error(
        `Tomorrow digest failed for ${input.kind} ${input.recipientId}: `
          + (error instanceof Error ? error.message : String(error)),
      );
      return 'error';
    }
  }

  private async resolveRecipientChatId(
    kind: InstructorScheduleDigestKind,
    recipientId: string,
  ): Promise<string | null> {
    if (kind === 'teacher') {
      const teacher = await this.teacherRepo.findOne({ where: { id: recipientId } });
      if (!teacher) return null;
      const profileTg = (teacher.telegramId ?? '').trim();
      if (profileTg) return profileTg;
      if (!teacher.userId) return null;
      const user = await this.userRepo.findOne({ where: { id: teacher.userId } });
      return (user?.telegramId ?? '').trim() || null;
    }

    const tutor = await this.tutorRepo.findOne({ where: { id: recipientId } });
    if (!tutor?.userId) return null;
    const user = await this.userRepo.findOne({ where: { id: tutor.userId } });
    return (user?.telegramId ?? '').trim() || null;
  }

  private async resolveParticipantLabel(lesson: LessonEntity): Promise<string> {
    if (lesson.groupId) {
      const group = await this.groupRepo.findOne({ where: { id: lesson.groupId } });
      const name = group?.name?.trim();
      if (name) return name;
    }

    if (lesson.primaryStudentId) {
      const student = await this.studentRepo.findOne({
        where: { id: lesson.primaryStudentId },
      });
      const name = student
        ? formatStudentProfileDisplayName(student).trim()
        : '';
      if (name) return name;
    }

    if (lesson.primaryTeacherStudentContactId) {
      const contact = await this.contactRepo.findOne({
        where: { id: lesson.primaryTeacherStudentContactId },
      });
      const name = contact?.name?.trim();
      if (name) return name;
    }

    if (lesson.primaryTutorStudentId) {
      const pupil = await this.tutorStudentRepo.findOne({
        where: { id: lesson.primaryTutorStudentId },
      });
      const name = pupil?.name?.trim() || '';
      if (name) return name;
    }

    const studentIds =
      await this.confirmations.resolveParticipantStudentIds(lesson);
    if (studentIds.length > 0) {
      const students = await this.studentRepo.find({
        where: { id: In(studentIds) },
      });
      const names = students
        .map((s) => formatStudentProfileDisplayName(s).trim())
        .filter(Boolean);
      if (names.length === 1) return names[0];
      if (names.length > 1) {
        const shown = names.slice(0, 3).join(', ');
        const rest = names.length - 3;
        return rest > 0 ? `${shown} и ещё ${rest}` : shown;
      }
    }

    if (lesson.lessonType === 'group') return 'Групповое занятие';
    return 'Индивидуальное занятие';
  }

  private async claimDigestSlot(
    kind: InstructorScheduleDigestKind,
    recipientId: string,
    scheduleDate: string,
    lessonCount: number,
  ): Promise<boolean> {
    try {
      await this.digestRepo.insert({
        recipientKind: kind,
        recipientId,
        scheduleDate,
        lessonCount,
        sentAt: new Date(),
      });
      return true;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        return false;
      }
      throw error;
    }
  }

  private async releaseDigestSlot(
    kind: InstructorScheduleDigestKind,
    recipientId: string,
    scheduleDate: string,
  ): Promise<void> {
    await this.digestRepo.delete({
      recipientKind: kind,
      recipientId,
      scheduleDate,
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    if (error instanceof QueryFailedError) {
      const code = (
        error as QueryFailedError & { driverError?: { code?: string } }
      ).driverError?.code;
      if (code === '23505') return true;
    }
    return (error as { code?: string })?.code === '23505';
  }
}
