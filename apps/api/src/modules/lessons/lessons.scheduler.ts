import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobGuard } from '../../common/concurrency/job-guard';
import { LessonEntity } from './entities/lesson.entity';
import { LessonsService } from './lessons.service';

export type ProcessCompletedLessonsResult = {
  success: true;
  message: string;
  count: number;
  skipped: number;
  errors: number;
};

/**
 * Auto-finalizes lessons whose wall-clock end time has passed.
 * Completion side effects always go through LessonsService.completeExpiredBySystem
 * → finalizeLessonCompletion (balance, TeacherPayment, attendance).
 */
@Injectable()
export class LessonsScheduler {
  private readonly logger = new Logger(LessonsScheduler.name);
  private readonly guard = new JobGuard(this.logger, 'processCompletedLessons');

  constructor(
    private readonly lessonsService: LessonsService,
    private readonly config: ConfigService,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
  ) {}

  @Cron('*/5 * * * *')
  async runAutoCompleteCron(): Promise<void> {
    if (!this.config.get<boolean>('jobs.enabled')) {
      return;
    }
    await this.guard.run(async () => {
      const result = await this.processCompletedLessons();
      if (result.count > 0 || result.errors > 0) {
        this.logger.log(
          `Auto-completed lessons: completed=${result.count} skipped=${result.skipped} errors=${result.errors}`,
        );
      }
    });
  }

  /**
   * Manual / test entry point — does not wait for the cron tick.
   */
  async processCompletedLessons(): Promise<ProcessCompletedLessonsResult> {
    const lessons = await this.lessonRepo.find({
      where: { status: 'planned' },
      order: { date: 'ASC', startTime: 'ASC' },
      take: 500,
    });
    const now = this.getTimezoneNow();
    let count = 0;
    let skipped = 0;
    let errors = 0;

    for (const lesson of lessons) {
      if (!this.hasEnded(lesson, now)) {
        skipped += 1;
        continue;
      }

      try {
        const completed = await this.lessonsService.completeExpiredBySystem(
          lesson.id,
        );
        if (completed) {
          count += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        errors += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to auto-complete lesson ${lesson.id}: ${message}`,
        );
      }
    }

    return {
      success: true,
      message: `Auto-completed ${count} lessons`,
      count,
      skipped,
      errors,
    };
  }

  private hasEnded(lesson: LessonEntity, now: Date): boolean {
    return this.getLessonEndTime(lesson).getTime() <= now.getTime();
  }

  private getLessonStartTime(lesson: LessonEntity): Date {
    const [year, month, day] = String(lesson.date || '')
      .split('-')
      .map(Number);
    const [hours, minutes] = String(lesson.startTime || '00:00')
      .split(':')
      .map(Number);
    return new Date(year, month - 1, day, hours, minutes || 0);
  }

  private getLessonEndTime(lesson: LessonEntity): Date {
    const start = this.getLessonStartTime(lesson);
    return new Date(start.getTime() + (lesson.duration || 60) * 60_000);
  }

  /**
   * Wall-clock "now" in REMINDER_TIMEZONE (default Europe/Minsk),
   * aligned with lesson date/start_time storage and confirmation jobs.
   */
  private getTimezoneNow(): Date {
    const tz =
      this.config.get<string>('jobs.reminderTimezone') ?? 'Europe/Minsk';
    const now = new Date();
    const localized = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const offsetMs = localized.getTime() - now.getTime();
    return new Date(now.getTime() + offsetMs);
  }
}
