import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PendingRegistrationRepository } from './pending-registration.repository';

@Injectable()
export class PendingRegistrationCleanupService {
  private readonly logger = new Logger(PendingRegistrationCleanupService.name);

  constructor(
    private readonly pendingRepository: PendingRegistrationRepository,
    private readonly config: ConfigService,
  ) {}

  @Cron('*/15 * * * *')
  async runScheduledCleanup(): Promise<void> {
    if (!this.config.get<boolean>('jobs.enabled')) {
      return;
    }
    await this.cleanupExpiredPendingRegistrations();
  }

  async cleanupExpiredPendingRegistrations(): Promise<number> {
    const startedAt = Date.now();
    this.logger.log('PendingRegistration cleanup started');

    try {
      const ttlHours = this.config.get<number>('pendingRegistration.ttlHours') ?? 24;
      const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);
      const deleted = await this.pendingRepository.deleteExpiredUncompleted(cutoff);

      const elapsed = Date.now() - startedAt;
      this.logger.log('PendingRegistration cleanup finished');
      this.logger.log(`Deleted: ${deleted} registrations`);
      this.logger.log(`Execution time: ${elapsed} ms`);

      return deleted;
    } catch (error) {
      this.logger.error(error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }
}
