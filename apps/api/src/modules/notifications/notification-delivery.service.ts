import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { QueryFailedError, Repository } from 'typeorm';
import { NotificationEntity, NotificationChannel } from './entities/notification.entity';
import { resolveNotificationDeepLink } from './notification-deep-links';
import { NotificationPreferencesService } from './notification-preferences.service';
import {
  PlatformEvent,
  PlatformEventType,
  normalizeLegacyNotificationType,
} from './platform-event.types';
import { WebPushSenderService } from './web-push-sender.service';
import { UserEntity } from '../users/entities/user.entity';

export interface FanoutInput {
  eventId?: string;
  eventType: PlatformEventType | string;
  recipientId: string;
  title: string;
  body: string;
  referenceType?: string | null;
  referenceId?: string | null;
  deepLink?: string | null;
  /** Channels to attempt (filtered by preferences). Default: in_app + web_push */
  channels?: NotificationChannel[];
  payload?: Record<string, string | number | boolean | null>;
  /** When true, skip web_push (e.g. user currently viewing the chat). */
  suppressPush?: boolean;
}

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notifications: Repository<NotificationEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly preferences: NotificationPreferencesService,
    private readonly webPush: WebPushSenderService,
  ) {}

  /**
   * Idempotent multi-channel delivery for one recipient.
   * UNIQUE (event_id, user_id, channel) prevents duplicates on retry.
   */
  async fanoutToRecipient(input: FanoutInput): Promise<NotificationEntity[]> {
    const eventId = input.eventId || randomUUID();
    const eventType = String(input.eventType);
    const catalogType =
      normalizeLegacyNotificationType(eventType) || (eventType as PlatformEventType);

    const user = await this.users.findOne({ where: { id: input.recipientId } });
    const deepLink =
      input.deepLink
      || resolveNotificationDeepLink({
        eventType: catalogType,
        role: user?.role,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        payload: input.payload,
      });

    const wanted = (input.channels || ['in_app', 'web_push']).filter((ch) => {
      if (input.suppressPush && ch === 'web_push') return false;
      return true;
    });

    this.logger.log(
      `notification_event_created event=${eventId} user=${input.recipientId} type=${eventType} channels=${wanted.join(',')}`,
    );

    const created: NotificationEntity[] = [];
    for (const channel of wanted) {
      try {
        const enabled = await this.preferences.isChannelEnabled(
          input.recipientId,
          catalogType,
          channel,
        );
        if (!enabled) {
          this.logger.debug(
            `channel_skipped event=${eventId} channel=${channel} reason=preference_disabled`,
          );
          continue;
        }

        this.logger.debug(`channel_selected event=${eventId} channel=${channel}`);

        const row = await this.createIdempotent({
          eventId,
          userId: input.recipientId,
          channel,
          type: eventType,
          title: input.title,
          body: input.body,
          referenceType: input.referenceType || null,
          referenceId: input.referenceId || null,
          deepLink,
        });
        if (!row) continue;
        created.push(row);

        if (channel === 'web_push') {
          try {
            const result = await this.webPush.sendToUser(input.recipientId, {
              notificationId: row.id,
              eventId,
              type: eventType,
              title: input.title,
              body: input.body,
              deepLink,
              timestamp: Date.now(),
            });
            if (result.sent > 0) {
              row.status = 'sent';
              row.sentAt = new Date();
              row.attemptCount = (row.attemptCount || 0) + 1;
              await this.notifications.save(row);
            } else if (result.failed > 0) {
              row.status = 'failed';
              row.attemptCount = (row.attemptCount || 0) + 1;
              row.lastError = 'web_push_delivery_failed';
              await this.notifications.save(row);
            } else {
              // No subscriptions / VAPID off — keep pending (user may enable later).
              row.attemptCount = (row.attemptCount || 0) + 1;
              await this.notifications.save(row);
            }
          } catch (err) {
            this.logger.warn(
              `push_channel_error event=${eventId} user=${input.recipientId}: ${
                err instanceof Error ? err.message : 'unknown'
              }`,
            );
          }
        } else if (channel === 'in_app') {
          row.status = 'sent';
          row.sentAt = new Date();
          await this.notifications.save(row);
        }
      } catch (err) {
        this.logger.warn(
          `channel_failed event=${eventId} channel=${channel}: ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        );
      }
    }
    return created;
  }

  async deliverPlatformEvent(event: PlatformEvent): Promise<void> {
    for (const recipientId of event.recipientIds) {
      try {
        const title = String(event.payload.title || event.eventType);
        const body = String(event.payload.body || '');
        await this.fanoutToRecipient({
          eventId: event.eventId,
          eventType: event.eventType,
          recipientId,
          title,
          body,
          referenceType: event.entityType,
          referenceId: event.entityId,
          payload: event.payload,
        });
      } catch (err) {
        this.logger.warn(
          `Fanout failed event=${event.eventId} user=${recipientId}: ${String(err)}`,
        );
      }
    }
  }

  private async createIdempotent(
    data: Partial<NotificationEntity> & {
      eventId: string;
      userId: string;
      channel: NotificationChannel;
      type: string;
      title: string;
      body: string;
    },
  ): Promise<NotificationEntity | null> {
    const existing = await this.notifications.findOne({
      where: {
        eventId: data.eventId,
        userId: data.userId,
        channel: data.channel,
      },
    });
    if (existing) return existing;

    try {
      const row = this.notifications.create({
        ...data,
        status: data.channel === 'web_push' ? 'pending' : 'sent',
        sentAt: data.channel === 'in_app' ? new Date() : null,
        attemptCount: 0,
        readAt: null,
        lastError: null,
      });
      return await this.notifications.save(row);
    } catch (err) {
      if (err instanceof QueryFailedError && String(err.message).includes('UQ_NOTIFICATION_EVENT_USER_CHANNEL')) {
        return this.notifications.findOne({
          where: {
            eventId: data.eventId,
            userId: data.userId,
            channel: data.channel,
          },
        });
      }
      throw err;
    }
  }
}
