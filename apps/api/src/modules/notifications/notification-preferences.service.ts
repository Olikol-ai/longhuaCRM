import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationPreferenceCategory,
  NotificationPreferenceEntity,
} from './entities/notification-preference.entity';
import { NotificationChannel } from './entities/notification.entity';
import { categoryForEvent, PlatformEventType } from './platform-event.types';

const ALL_CATEGORIES: NotificationPreferenceCategory[] = [
  'messages',
  'lessons',
  'homework',
  'materials',
  'payments',
  'certificates',
  'exams',
  'system',
];

@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreferenceEntity)
    private readonly repo: Repository<NotificationPreferenceEntity>,
  ) {}

  async listForUser(userId: string): Promise<NotificationPreferenceEntity[]> {
    const existing = await this.repo.find({ where: { userId } });
    const byCat = new Map(existing.map((row) => [row.category, row]));
    const out: NotificationPreferenceEntity[] = [];
    for (const category of ALL_CATEGORIES) {
      const row = byCat.get(category);
      if (row) {
        out.push(row);
        continue;
      }
      out.push(
        this.repo.create({
          userId,
          category,
          pushEnabled: true,
          inAppEnabled: true,
          telegramEnabled: true,
        }),
      );
    }
    return out;
  }

  async upsert(
    userId: string,
    category: NotificationPreferenceCategory,
    patch: Partial<Pick<NotificationPreferenceEntity, 'pushEnabled' | 'inAppEnabled' | 'telegramEnabled'>>,
  ): Promise<NotificationPreferenceEntity> {
    let row = await this.repo.findOne({ where: { userId, category } });
    if (!row) {
      row = this.repo.create({
        userId,
        category,
        pushEnabled: true,
        inAppEnabled: true,
        telegramEnabled: true,
      });
    }
    if (typeof patch.pushEnabled === 'boolean') row.pushEnabled = patch.pushEnabled;
    if (typeof patch.inAppEnabled === 'boolean') row.inAppEnabled = patch.inAppEnabled;
    if (typeof patch.telegramEnabled === 'boolean') row.telegramEnabled = patch.telegramEnabled;
    // System push/in-app cannot be fully disabled (security/system).
    if (category === 'system') {
      row.pushEnabled = true;
      row.inAppEnabled = true;
    }
    return this.repo.save(row);
  }

  async isChannelEnabled(
    userId: string,
    eventType: PlatformEventType | string,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const category = categoryForEvent(
      (String(eventType).includes('.')
        ? eventType
        : 'system.announcement') as PlatformEventType,
    );
    if (category === 'system' && (channel === 'web_push' || channel === 'in_app')) {
      return true;
    }
    const row = await this.repo.findOne({ where: { userId, category } });
    if (!row) return true;
    if (channel === 'web_push') return row.pushEnabled !== false;
    if (channel === 'in_app') return row.inAppEnabled !== false;
    if (channel === 'telegram') return row.telegramEnabled !== false;
    return true;
  }
}
