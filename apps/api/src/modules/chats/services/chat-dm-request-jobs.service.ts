import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DirectChatRequestService } from './direct-chat-request.service';

/**
 * Expires stale pending DM requests (CHAT_DM_REQUEST_TTL_DAYS).
 */
@Injectable()
export class ChatDmRequestJobsService {
  private readonly logger = new Logger(ChatDmRequestJobsService.name);

  constructor(
    private readonly dmRequests: DirectChatRequestService,
    private readonly config: ConfigService,
  ) {}

  @Cron('15 * * * *')
  async expireStaleRequests(): Promise<void> {
    if (!this.config.get<boolean>('jobs.enabled')) return;
    const affected = await this.dmRequests.expirePending();
    if (affected > 0) {
      this.logger.log(`Expired ${affected} pending DM request(s)`);
    }
  }
}
