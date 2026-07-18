import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { JobGuard } from '../../../common/concurrency/job-guard';
import { AttemptStatus, SubmitReason } from '../enums';
import {
  AssessmentAttemptRepository,
  AssessmentExamRepository,
} from '../repositories';
import { AttemptService } from './attempt.service';

/**
 * Auto-submits started Attempts after expires_at (submit_reason=timeout).
 * Uses Nest ScheduleModule already registered in AppModule.
 */
@Injectable()
export class AssessmentTimeoutJobService {
  private readonly logger = new Logger(AssessmentTimeoutJobService.name);
  private readonly guard = new JobGuard(this.logger, 'assessmentTimeout');

  constructor(
    private readonly attempts: AssessmentAttemptRepository,
    private readonly exams: AssessmentExamRepository,
    private readonly attemptService: AttemptService,
    private readonly config: ConfigService,
  ) {}

  @Cron('* * * * *')
  async runScheduledTimeouts(): Promise<void> {
    if (!this.config.get<boolean>('jobs.enabled')) {
      return;
    }
    await this.guard.run(async () => {
      await this.processExpiredAttempts();
    });
  }

  /**
   * Find started Attempts past deadline and submit with timeout reason.
   * Returns count of successfully submitted attempts.
   */
  async processExpiredAttempts(now: Date = new Date()): Promise<number> {
    const expired = await this.attempts.findExpiredStartedAttempts(now, 100);
    let submitted = 0;

    for (const attempt of expired) {
      if (attempt.status !== AttemptStatus.Started) {
        continue;
      }

      const rule = await this.exams.findRuleByExamId(attempt.examId);
      if (rule && rule.autoSubmitOnTimeout === false) {
        this.logger.debug(
          `Skip timeout for Attempt ${attempt.id}: autoSubmitOnTimeout=false`,
        );
        continue;
      }

      try {
        await this.attemptService.submit({
          attemptId: attempt.id,
          submitReason: SubmitReason.Timeout,
        });
        submitted += 1;
        this.logger.log(
          `Timeout auto-submit Attempt ${attempt.id} (expires_at=${attempt.expiresAt?.toISOString() ?? 'n/a'})`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Timeout submit skipped for Attempt ${attempt.id}: ${message}`,
        );
      }
    }

    if (submitted > 0) {
      this.logger.log(`Assessment timeout job submitted ${submitted} attempt(s)`);
    }

    return submitted;
  }
}
