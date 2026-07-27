import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { LessonsScheduler } from '../lessons/lessons.scheduler';
import { MaterialAccessEntity } from '../materials/entities/material-access.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { UserEntity } from '../users/entities/user.entity';

/**
 * Maintenance jobs only.
 * Lesson auto-completion lives in LessonsScheduler (every 5 minutes).
 * Lesson Telegram confirmations live in LessonConfirmationJobsService.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly lessonsScheduler: LessonsScheduler,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Admin/functions endpoint — delegates to LessonsScheduler.processCompletedLessons.
   */
  async autoCompleteExpiredLessons() {
    const result = await this.lessonsScheduler.processCompletedLessons();
    if (result.count > 0) {
      this.logger.log(`Auto-completed ${result.count} expired lessons`);
    }
    return result;
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
}
