import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// web-push is CJS
import webpush = require('web-push');
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { PushSubscriptionsService } from './push-subscriptions.service';
import {
  assertNoSecretsInPushPayload,
  buildSafePushPayload,
  shouldRetryPushStatus,
  shouldRevokePushStatus,
} from './push-subscription.logic';

export interface WebPushPayload {
  notificationId: string;
  eventId: string | null;
  type: string;
  title: string;
  body: string;
  deepLink: string | null;
  timestamp: number;
}

const MAX_ATTEMPTS = 3;

@Injectable()
export class WebPushSenderService {
  private readonly logger = new Logger(WebPushSenderService.name);
  private configured = false;
  private configError: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly subscriptions: PushSubscriptionsService,
  ) {
    this.configure();
  }

  private configure(): void {
    const publicKey = (this.config.get<string>('webPush.vapidPublicKey') || '').trim();
    const privateKey = (this.config.get<string>('webPush.vapidPrivateKey') || '').trim();
    const subject = (this.config.get<string>('webPush.vapidSubject') || 'mailto:admin@longhua.local').trim();
    if (!publicKey || !privateKey) {
      this.configured = false;
      this.configError = 'VAPID public/private keys not configured';
      this.logger.warn('VAPID keys not configured — Web Push delivery disabled');
      return;
    }
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.configured = true;
      this.configError = null;
    } catch (err) {
      this.configured = false;
      this.configError = 'Invalid VAPID configuration';
      // Never log private key material.
      this.logger.error(`VAPID configure failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getConfigError(): string | null {
    return this.configError;
  }

  getPublicKey(): string | null {
    const key = (this.config.get<string>('webPush.vapidPublicKey') || '').trim();
    return key || null;
  }

  /**
   * Send to all active devices for user. One dead subscription must not block others.
   */
  async sendToUser(userId: string, payload: WebPushPayload): Promise<{ sent: number; failed: number; skipped: boolean }> {
    if (!this.configured) {
      this.logger.debug(`push_skipped user=${userId} reason=vapid_unconfigured`);
      return { sent: 0, failed: 0, skipped: true };
    }
    const safe = buildSafePushPayload(payload);
    assertNoSecretsInPushPayload(safe);

    const rows = await this.subscriptions.listActiveForUser(userId);
    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      const ok = await this.sendOne(row, safe, 1);
      if (ok) sent += 1;
      else failed += 1;
    }
    this.logger.log(
      `push_fanout user=${userId} event=${safe.eventId || '-'} devices=${rows.length} sent=${sent} failed=${failed}`,
    );
    return { sent, failed, skipped: false };
  }

  private async sendOne(
    row: PushSubscriptionEntity,
    payload: ReturnType<typeof buildSafePushPayload>,
    attempt: number,
  ): Promise<boolean> {
    if (!this.configured) return false;
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        JSON.stringify(payload),
        { TTL: 60 * 60 },
      );
      this.logger.debug(`push_sent sub=${row.id} attempt=${attempt}`);
      return true;
    } catch (err: unknown) {
      const statusCode =
        err && typeof err === 'object' && 'statusCode' in err
          ? Number((err as { statusCode?: number }).statusCode)
          : 0;
      if (shouldRevokePushStatus(statusCode)) {
        await this.subscriptions.revokeByEndpoint(row.endpoint);
        this.logger.log(`push_subscription_revoked sub=${row.id} status=${statusCode}`);
        return false;
      }
      if (attempt < MAX_ATTEMPTS && shouldRetryPushStatus(statusCode)) {
        await new Promise((r) => setTimeout(r, 200 * attempt));
        return this.sendOne(row, payload, attempt + 1);
      }
      this.logger.warn(
        `push_rejected sub=${row.id} status=${statusCode || 'n/a'} attempts=${attempt}`,
      );
      return false;
    }
  }
}
