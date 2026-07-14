import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramDiagnosticsService } from './telegram-diagnostics.service';
import { TelegramGateway } from './telegram.gateway';
import { TelegramService } from './telegram.service';

@Injectable()
export class TelegramPollingService
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(TelegramPollingService.name);
  private running = false;
  private offset = 0;
  private loopPromise: Promise<void> | null = null;
  private webhookCleared = false;
  private sleepWake: (() => void) | null = null;
  private sleepTimer: ReturnType<typeof setTimeout> | null = null;
  private pollAbort: AbortController | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly gateway: TelegramGateway,
    private readonly telegramService: TelegramService,
    private readonly diagnostics: TelegramDiagnosticsService,
  ) {}

  async onApplicationBootstrap() {
    if (!this.config.get<boolean>('telegram.enabled')) {
      return;
    }
    if (this.config.get<string>('telegram.mode') !== 'polling') {
      return;
    }
    if (this.config.get<boolean>('telegram.mock') === true) {
      this.logger.log('Telegram polling skipped (TELEGRAM_MOCK=true)');
      return;
    }

    const botToken = (this.config.get<string>('telegram.botToken') ?? '').trim();
    if (!botToken) {
      this.logger.error(
        'Telegram polling not started: TELEGRAM_BOT_TOKEN is empty. Set the token in .env.',
      );
      return;
    }

    if (!this.webhookCleared) {
      await this.telegramService.deleteWebhook();
      await this.telegramService.clearBotCommands();
      this.webhookCleared = true;
    }

    this.running = true;
    this.diagnostics.setPollingRunning(true);
    this.logger.log('Telegram polling started');
    this.loopPromise = this.pollLoop();
  }

  async beforeApplicationShutdown() {
    this.running = false;
    this.diagnostics.setPollingRunning(false);
    this.pollAbort?.abort();
    this.pollAbort = null;
    this.interruptSleep();
    if (this.loopPromise) {
      await this.loopPromise;
      this.loopPromise = null;
    }
  }

  private async pollLoop(): Promise<void> {
    while (this.running) {
      try {
        this.pollAbort = new AbortController();
        const result = await this.gateway.getUpdates(
          this.offset,
          25,
          this.pollAbort.signal,
        );
        if (!this.running) {
          break;
        }
        if (!result.ok) {
          if (result.error === 'aborted') {
            break;
          }
          this.logger.warn(`getUpdates failed: ${result.error ?? result.description}`);
          await this.sleep(2000);
          continue;
        }
        const updates = Array.isArray(result.result)
          ? (result.result as Array<Record<string, unknown>>)
          : [];
        for (const update of updates) {
          if (!this.running) {
            break;
          }
          const updateId = Number(update.update_id ?? 0);
          if (updateId >= this.offset) {
            this.offset = updateId + 1;
          }
          this.logger.debug(`Telegram update received: update_id=${updateId}`);
          await this.telegramService.handleUpdate(update);
        }
      } catch (error) {
        if (!this.running) {
          break;
        }
        this.logger.error(`Polling error: ${(error as Error).message}`);
        await this.sleep(2000);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.sleepWake = () => {
        if (this.sleepTimer) {
          clearTimeout(this.sleepTimer);
          this.sleepTimer = null;
        }
        this.sleepWake = null;
        resolve();
      };
      this.sleepTimer = setTimeout(() => {
        this.sleepTimer = null;
        const wake = this.sleepWake;
        this.sleepWake = null;
        wake?.();
      }, ms);
    });
  }

  private interruptSleep(): void {
    this.sleepWake?.();
  }
}
