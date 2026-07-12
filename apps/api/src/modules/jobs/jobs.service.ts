import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { SYSTEM_ACTOR } from '../../common/access/access.constants';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { LessonsService } from '../lessons/lessons.service';
import { MaterialAccessEntity } from '../materials/entities/material-access.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { UserEntity } from '../users/entities/user.entity';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly lessonsService: LessonsService,
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

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
    const lessons = await this.lessonsService.filter(SYSTEM_ACTOR, { status: 'planned' });
    const now = new Date();
    let count = 0;

    for (const lesson of lessons.slice(0, 1000)) {
      const endTime = this.getLessonEndTime(lesson);
      if (endTime < now) {
        await this.lessonsService.complete(SYSTEM_ACTOR, lesson.id);
        count++;
      }
    }

    return { success: true, message: `Auto-completed ${count} lessons`, count };
  }

  async sendLessonReminders24h() {
    const botToken = await this.telegramService.getBotToken();
    if (!botToken) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' };

    const tomorrowStr = this.getTomorrowDateStr();
    const lessons = (await this.lessonsService.filter(SYSTEM_ACTOR, { date: tomorrowStr, status: 'planned' }))
      .filter((lesson) => !lesson.reminder24hSent);

    if (lessons.length === 0) {
      return { ok: true, sent: 0, message: 'No lessons tomorrow' };
    }

    const { studentMap, teacherMap } = await this.loadParticipantMaps();
    let sentCount = 0;

    for (const lesson of lessons) {
      await this.lessonsService.update(SYSTEM_ACTOR, lesson.id, { reminder24hSent: true });

      const teacher = teacherMap.get(lesson.teacherId);
      const lessonStudents = await this.resolveLessonStudents(lesson, studentMap);

      const timeStr = lesson.startTime;
      const duration = lesson.duration || 60;
      const formatStr = lesson.lessonFormat === 'offline' ? 'очно' : 'онлайн';

      for (const student of lessonStudents) {
        if (!student.telegramId) continue;
        const teacherName = teacher?.name || 'Преподаватель';
        let msg = `📅 Напоминание об уроке!\n\nЗавтра в ${timeStr} (${duration} мин, ${formatStr})\n👩‍🏫 Преподаватель: ${teacherName}\n💡 Баланс уроков: ${student.lessonBalance || 0}`;
        if (lesson.meetingLink && lesson.lessonFormat !== 'offline') {
          msg += `\n\n🔗 Ссылка на урок:\n${lesson.meetingLink}`;
        }
        const result = await this.telegramService.sendMessage(String(student.telegramId), msg);
        if (result.ok) sentCount++;
      }

      if (teacher?.telegramId) {
        const studentNames = lessonStudents.map((s) => s.name).join(', ') || '—';
        let msg = `📅 Напоминание об уроке!\n\nЗавтра в ${timeStr} (${duration} мин, ${formatStr})\n👤 Ученик${lessonStudents.length > 1 ? 'и' : ''}: ${studentNames}`;
        if (lesson.meetingLink && lesson.lessonFormat !== 'offline') {
          msg += `\n\n🔗 Ссылка на урок:\n${lesson.meetingLink}`;
        }
        const result = await this.telegramService.sendMessage(String(teacher.telegramId), msg);
        if (result.ok) sentCount++;
      }
    }

    return { ok: true, sent: sentCount, lessons: lessons.length };
  }

  async sendLessonReminders2h() {
    const botToken = await this.telegramService.getBotToken();
    if (!botToken) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' };

    const mskNow = this.getTimezoneNow();
    const planned = await this.lessonsService.filter(SYSTEM_ACTOR, { status: 'planned' });
    const lessons = planned.filter((lesson) => {
      if (lesson.reminder2hSent) return false;
      const lessonStart = this.getLessonStartTime(lesson);
      const diffMin = (lessonStart.getTime() - mskNow.getTime()) / 60000;
      return diffMin >= 110 && diffMin <= 125;
    });

    const { studentMap, teacherMap } = await this.loadParticipantMaps();
    let sentCount = 0;

    for (const lesson of lessons) {
      await this.lessonsService.update(SYSTEM_ACTOR, lesson.id, { reminder2hSent: true });

      const teacher = teacherMap.get(lesson.teacherId);
      const lessonStudents = await this.resolveLessonStudents(lesson, studentMap);

      for (const student of lessonStudents) {
        if (!student.telegramId) continue;
        const msg = `⏰ Урок через 2 часа!\n\nСегодня в ${lesson.startTime}\n👩‍🏫 ${teacher?.name || 'Преподаватель'}`;
        const result = await this.telegramService.sendMessage(String(student.telegramId), msg);
        if (result.ok) sentCount++;
      }
    }

    return { ok: true, sent: sentCount, lessons_matched: lessons.length, checked: planned.length };
  }

  async exportBackup() {
    const tables = [
      ['users', UserEntity],
      ['students', StudentEntity],
      ['teachers', TeacherEntity],
      ['lessons', LessonEntity],
    ] as const;

    const backup: Record<string, unknown> = {};
    let totalRecords = 0;

    for (const [name, entity] of tables) {
      const records = await this.dataSource.getRepository(entity).find({ take: 5000 });
      backup[name] = records;
      totalRecords += records.length;
    }

    backup._metadata = {
      exportedAt: new Date().toISOString(),
      totalRecords,
      exportedEntities: tables.length,
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
    const repo = this.dataSource.getRepository(MaterialAccessEntity);
    const toDelete = await repo.find({ where: { grantedByRole: In(['TEACHER']) } });
    if (toDelete.length > 0) {
      await repo.remove(toDelete);
    }
    return {
      success: true,
      message: `Revoked ${toDelete.length} access records`,
      deletedCount: toDelete.length,
    };
  }

  private async loadParticipantMaps() {
    const [students, teachers] = await Promise.all([
      this.dataSource.getRepository(StudentEntity).find(),
      this.dataSource.getRepository(TeacherEntity).find(),
    ]);
    return {
      studentMap: new Map(students.map((s) => [s.id, s])),
      teacherMap: new Map(teachers.map((t) => [t.id, t])),
    };
  }

  private async resolveLessonStudents(
    lesson: LessonEntity,
    studentMap: Map<string, StudentEntity>,
  ): Promise<StudentEntity[]> {
    if (lesson.primaryStudentId && studentMap.has(lesson.primaryStudentId)) {
      return [studentMap.get(lesson.primaryStudentId)!];
    }

    const attendance = await this.dataSource.getRepository(AttendanceEntity).find({
      where: { lessonId: lesson.id },
    });
    return attendance
      .map((row) => studentMap.get(row.studentId))
      .filter((row): row is StudentEntity => Boolean(row));
  }

  private getLessonStartTime(lesson: LessonEntity): Date {
    const [year, month, day] = String(lesson.date || '').split('-').map(Number);
    const [hours, minutes] = String(lesson.startTime || '00:00').split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }

  private getLessonEndTime(lesson: LessonEntity): Date {
    const start = this.getLessonStartTime(lesson);
    return new Date(start.getTime() + (lesson.duration || 60) * 60000);
  }

  private getTomorrowDateStr(): string {
    const mskNow = this.getTimezoneNow();
    const tomorrow = new Date(mskNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  private getTimezoneNow(): Date {
    const tz = this.config.get<string>('jobs.reminderTimezone') ?? 'Europe/Minsk';
    const now = new Date();
    const localized = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const offsetMs = localized.getTime() - now.getTime();
    return new Date(now.getTime() + offsetMs);
  }
}
