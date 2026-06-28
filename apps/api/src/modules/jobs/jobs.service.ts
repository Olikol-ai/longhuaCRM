import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ENTITY_NAMES } from '../../common/constants/entity-names';
import { EntityRepositoryService } from '../entities/entity-repository.service';
import { LessonSeriesService } from '../schedule/lesson-series.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly entityRepository: EntityRepositoryService,
    private readonly lessonSeries: LessonSeriesService,
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 3 * * *')
  async runDailyRecurringLessons() {
    if (!this.config.get<boolean>('jobs.enabled')) return;
    const result = await this.lessonSeries.maintainActiveSeries();
    this.logger.log(
      `Lesson series maintenance: created=${result.created}, skipped=${result.skipped}`,
    );
  }

  @Cron('0 12 * * *')
  async run24hReminders() {
    if (!this.config.get<boolean>('jobs.enabled')) return;
    await this.sendLessonReminders24h();
  }

  @Cron('* * * * *')
  async runMinuteJobs() {
    if (!this.config.get<boolean>('jobs.enabled')) return;
    await Promise.all([this.sendLessonReminders2h(), this.autoCompleteExpiredLessons()]);
  }

  async autoCompleteExpiredLessons() {
    const ctx = this.entityRepository.getSystemContext();
    const lessons = (await this.entityRepository.filter('Lesson', { status: 'planned' }, ctx)).slice(0, 1000);
    const now = new Date();
    let count = 0;

    for (const lesson of lessons) {
      const [year, month, day] = String(lesson.date || '').split('-').map(Number);
      const [hours, minutes] = String(lesson.start_time || '00:00').split(':').map(Number);
      const endTime = new Date(year, month - 1, day, hours, minutes + ((lesson.duration as number) || 60));
      if (endTime < now) {
        await this.entityRepository.update('Lesson', String(lesson.id), { status: 'completed' }, ctx);
        count++;
      }
    }

    return { success: true, message: `Auto-completed ${count} lessons`, count };
  }

  async sendLessonReminders24h() {
    const botToken = await this.telegramService.getBotToken();
    if (!botToken) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' };

    const mskNow = this.getTimezoneNow();
    const tomorrow = new Date(mskNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const ctx = this.entityRepository.getSystemContext();
    const allTomorrow = await this.entityRepository.filter('Lesson', {
      date: tomorrowStr,
      status: 'planned',
    }, ctx);
    const lessons = allTomorrow.filter((l) => !l.reminder_24h_sent);

    if (lessons.length === 0) {
      return { ok: true, sent: 0, message: 'No lessons tomorrow' };
    }

    const students = await this.entityRepository.list('Student', ctx);
    const teachers = await this.entityRepository.list('Teacher', ctx);
    const studentMap = Object.fromEntries(students.map((s) => [s.id, s]));
    const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t]));

    let sentCount = 0;

    for (const lesson of lessons) {
      await this.entityRepository.update('Lesson', String(lesson.id), { reminder_24h_sent: true }, ctx);

      const teacher = teacherMap[String(lesson.teacher_id)];
      const studentIds = this.resolveStudentIds(lesson);
      const lessonStudents = studentIds.map((id) => studentMap[id]).filter(Boolean);

      const timeStr = lesson.start_time;
      const duration = (lesson.duration as number) || 60;
      const formatStr = lesson.lesson_format === 'offline' ? 'очно' : 'онлайн';

      for (const student of lessonStudents) {
        if (!student.telegram_id) continue;
        const teacherName = (teacher?.name as string) || 'Преподаватель';
        let msg = `📅 Напоминание об уроке!\n\nЗавтра в ${timeStr} (${duration} мин, ${formatStr})\n👩‍🏫 Преподаватель: ${teacherName}\n💡 Баланс уроков: ${student.lesson_balance || 0}`;
        if (lesson.meeting_link && lesson.lesson_format !== 'offline') {
          msg += `\n\n🔗 Ссылка на урок:\n${lesson.meeting_link}`;
        }
        const result = await this.telegramService.sendMessage(String(student.telegram_id), msg);
        if (result.ok) sentCount++;
      }

      if (teacher?.telegram_id) {
        const studentNames = lessonStudents.map((s) => s.name).join(', ') || '—';
        let msg = `📅 Напоминание об уроке!\n\nЗавтра в ${timeStr} (${duration} мин, ${formatStr})\n👤 Ученик${lessonStudents.length > 1 ? 'и' : ''}: ${studentNames}`;
        if (lesson.meeting_link && lesson.lesson_format !== 'offline') {
          msg += `\n\n🔗 Ссылка на урок:\n${lesson.meeting_link}`;
        }
        const result = await this.telegramService.sendMessage(String(teacher.telegram_id), msg);
        if (result.ok) sentCount++;
      }
    }

    return { ok: true, sent: sentCount, lessons: lessons.length };
  }

  async sendLessonReminders2h() {
    const botToken = await this.telegramService.getBotToken();
    if (!botToken) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' };

    const mskNow = this.getTimezoneNow();
    const ctx = this.entityRepository.getSystemContext();
    const planned = await this.entityRepository.filter('Lesson', { status: 'planned' }, ctx);

    const lessons = planned.filter((lesson) => {
      if (lesson.reminder_2h_sent) return false;
      const [year, month, day] = String(lesson.date || '').split('-').map(Number);
      const [hours, minutes] = String(lesson.start_time || '00:00').split(':').map(Number);
      const lessonStart = new Date(year, month - 1, day, hours, minutes);
      const diffMin = (lessonStart.getTime() - mskNow.getTime()) / 60000;
      return diffMin >= 110 && diffMin <= 125;
    });

    const students = await this.entityRepository.list('Student', ctx);
    const teachers = await this.entityRepository.list('Teacher', ctx);
    const studentMap = Object.fromEntries(students.map((s) => [s.id, s]));
    const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t]));

    let sentCount = 0;

    for (const lesson of lessons) {
      await this.entityRepository.update('Lesson', String(lesson.id), { reminder_2h_sent: true }, ctx);

      const teacher = teacherMap[String(lesson.teacher_id)];
      const studentIds = this.resolveStudentIds(lesson);
      const lessonStudents = studentIds.map((id) => studentMap[id]).filter(Boolean);

      for (const student of lessonStudents) {
        if (!student.telegram_id) continue;
        const msg = `⏰ Урок через 2 часа!\n\nСегодня в ${lesson.start_time}\n👩‍🏫 ${(teacher?.name as string) || 'Преподаватель'}`;
        const result = await this.telegramService.sendMessage(String(student.telegram_id), msg);
        if (result.ok) sentCount++;
      }
    }

    return { ok: true, sent: sentCount, lessons_matched: lessons.length, checked: planned.length };
  }

  async exportBackup() {
    const entities = [...ENTITY_NAMES, 'User'] as const;
    const backup: Record<string, unknown> = {};
    let totalRecords = 0;

    const ctx = this.entityRepository.getSystemContext();

    for (const entity of entities) {
      try {
        const records = await this.entityRepository.list(entity, ctx, undefined, 1000);
        backup[entity] = records || [];
        totalRecords += records.length;
      } catch {
        backup[entity] = [];
      }
    }

    backup._metadata = {
      exportedAt: new Date().toISOString(),
      totalRecords,
      exportedEntities: entities.length,
    };

    const jsonData = JSON.stringify(backup, null, 2);
    const base64Data = Buffer.from(jsonData).toString('base64');

    return {
      success: true,
      data: base64Data,
      filename: `backup_${new Date().toISOString().split('T')[0]}.json.b64`,
      totalRecords,
    };
  }

  async revokeAllAccess() {
    const ctx = this.entityRepository.getSystemContext();
    const all = await this.entityRepository.list('MaterialAccess', ctx);
    const toDelete = all.filter((a) => a.granted_by_role !== 'ADMIN');
    for (const record of toDelete) {
      await this.entityRepository.deleteRecordById(String(record.id));
    }
    return {
      success: true,
      message: `Revoked ${toDelete.length} access records`,
      deletedCount: toDelete.length,
    };
  }

  private resolveStudentIds(lesson: Record<string, unknown>): string[] {
    const studentIds = lesson.student_ids as string[] | undefined;
    if (studentIds?.length) return studentIds;
    if (lesson.student_id) return [String(lesson.student_id)];
    return [];
  }

  private getTimezoneNow(): Date {
    const tz = this.config.get<string>('jobs.reminderTimezone') ?? 'Europe/Minsk';
    const now = new Date();
    const localized = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const offsetMs = localized.getTime() - now.getTime();
    return new Date(now.getTime() + offsetMs);
  }
}
