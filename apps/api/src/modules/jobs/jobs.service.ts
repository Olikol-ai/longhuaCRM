import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { SYSTEM_ACTOR } from '../../common/access/access.constants';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { LessonsService } from '../lessons/lessons.service';
import { MaterialAccessEntity } from '../materials/entities/material-access.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { UserEntity } from '../users/entities/user.entity';

/**
 * Maintenance jobs only. Lesson Telegram confirmations live in LessonConfirmationJobsService.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly lessonsService: LessonsService,
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Cron('* * * * *')
  async runMinuteJobs() {
    if (!this.config.get<boolean>('jobs.enabled')) return;
    await this.autoCompleteExpiredLessons();
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

  private getLessonStartTime(lesson: LessonEntity): Date {
    const [year, month, day] = String(lesson.date || '').split('-').map(Number);
    const [hours, minutes] = String(lesson.startTime || '00:00').split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }

  private getLessonEndTime(lesson: LessonEntity): Date {
    const start = this.getLessonStartTime(lesson);
    return new Date(start.getTime() + (lesson.duration || 60) * 60000);
  }
}
