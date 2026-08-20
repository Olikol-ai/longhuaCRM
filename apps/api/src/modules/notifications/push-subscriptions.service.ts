import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { mergeSubscriptionUpsert } from './push-subscription.logic';

export interface UpsertPushSubscriptionInput {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
  deviceLabel?: string | null;
}

@Injectable()
export class PushSubscriptionsService {
  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private readonly repo: Repository<PushSubscriptionEntity>,
  ) {}

  async upsert(input: UpsertPushSubscriptionInput): Promise<PushSubscriptionEntity> {
    const endpoint = String(input.endpoint || '').trim();
    const p256dh = String(input.p256dh || '').trim();
    const auth = String(input.auth || '').trim();
    if (!endpoint || !p256dh || !auth) {
      throw new BadRequestException('Invalid push subscription keys');
    }
    if (!input.userId) {
      throw new BadRequestException('userId required');
    }

    const existing = await this.repo.findOne({ where: { endpoint } });
    const merged = mergeSubscriptionUpsert(existing, {
      endpoint,
      p256dh,
      auth,
      userId: input.userId,
      userAgent: input.userAgent || null,
      deviceLabel: input.deviceLabel || null,
    });

    if (!existing) {
      const row = this.repo.create({
        endpoint: merged.endpoint,
        p256dh: merged.p256dh,
        auth: merged.auth,
        userId: merged.userId,
        userAgent: merged.userAgent,
        deviceLabel: merged.deviceLabel,
        lastSeenAt: new Date(),
        revokedAt: null,
      });
      return this.repo.save(row);
    }

    existing.userId = merged.userId;
    existing.p256dh = merged.p256dh;
    existing.auth = merged.auth;
    existing.userAgent = merged.userAgent;
    existing.deviceLabel = merged.deviceLabel;
    existing.lastSeenAt = new Date();
    existing.revokedAt = null;
    return this.repo.save(existing);
  }

  listActiveForUser(userId: string): Promise<PushSubscriptionEntity[]> {
    return this.repo.find({
      where: { userId, revokedAt: IsNull() },
      order: { updatedAt: 'DESC' },
    });
  }

  async revokeByEndpoint(endpoint: string): Promise<void> {
    const row = await this.repo.findOne({ where: { endpoint } });
    if (!row) return;
    row.revokedAt = new Date();
    await this.repo.save(row);
  }

  /**
   * Revoke one endpoint for the authenticated user only (device logout).
   * Does not touch other devices.
   */
  async revokeEndpointForUser(userId: string, endpoint: string): Promise<boolean> {
    const ep = String(endpoint || '').trim();
    if (!ep) throw new BadRequestException('endpoint required');
    const row = await this.repo.findOne({ where: { endpoint: ep } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Subscription not found');
    }
    row.revokedAt = new Date();
    await this.repo.save(row);
    return true;
  }

  async revokeByIdForUser(id: string, userId: string): Promise<void> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Subscription not found');
    }
    row.revokedAt = new Date();
    await this.repo.save(row);
  }
}
