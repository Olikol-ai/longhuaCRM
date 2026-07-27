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
      ['students', StudentEntity],
      ['teachers', TeacherEntity],
      ['lessons', LessonEntity],
    ] as const;

    const backup: Record<string, unknown> = {};
    let totalRecords = 0;

    const users = await this.dataSource.getRepository(UserEntity).find({ take: 5000 });
    const sanitizedUsers = users.map((user) => this.sanitizeUserForBackup(user));
    backup.users = sanitizedUsers;
    totalRecords += sanitizedUsers.length;

    for (const [name, entity] of tables) {
      const records = await this.dataSource.getRepository(entity).find({ take: 5000 });
      backup[name] = records;
      totalRecords += records.length;
    }

    backup._metadata = {
      exportedAt: new Date().toISOString(),
      totalRecords,
      exportedEntities: tables.length + 1,
      secretsOmitted: true,
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

  /**
   * Strip credential and token material from user rows before export.
   * Operational identity fields stay so admins can restore directory context.
   */
  private sanitizeUserForBackup(user: UserEntity): Record<string, unknown> {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      telegramId: user.telegramId,
      telegramUsername: user.telegramUsername,
      telegramConnectedAt: user.telegramConnectedAt,
      telegramNotify24h: user.telegramNotify24h,
      telegramNotify3h: user.telegramNotify3h,
      createdDate: user.createdDate,
      updatedDate: user.updatedDate,
    };
  }
}
