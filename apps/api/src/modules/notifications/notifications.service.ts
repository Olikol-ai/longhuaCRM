import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Not, Repository } from 'typeorm';
import { NotificationEntity } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly repository: NotificationsRepository,
    @InjectRepository(NotificationEntity)
    private readonly repo: Repository<NotificationEntity>,
  ) {}

  findAll(): Promise<NotificationEntity[]> {
    return this.repository.findAll();
  }

  async findById(id: string): Promise<NotificationEntity> {
    const row = await this.repository.findById(id);
    if (!row) {
      throw new NotFoundException('Notification not found');
    }
    return row;
  }

  create(dto: CreateNotificationDto): Promise<NotificationEntity> {
    return this.repository.save(dto);
  }

  async update(id: string, dto: UpdateNotificationDto): Promise<NotificationEntity> {
    const payload: Partial<NotificationEntity> = { ...dto };
    if (dto.status === 'read') {
      payload.readAt = new Date();
    }
    if (dto.status === 'sent') {
      payload.sentAt = new Date();
    }
    const row = await this.repository.update(id, payload);
    if (!row) {
      throw new NotFoundException('Notification not found');
    }
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.repository.delete(id);
  }

  filter(where: Record<string, unknown>): Promise<NotificationEntity[]> {
    return this.repository.filter(where as FindOptionsWhere<NotificationEntity>);
  }

  /** In-app feed for one user (newest first). */
  listForUser(userId: string, limit = 100): Promise<NotificationEntity[]> {
    return this.repo.find({
      where: { userId, channel: 'in_app' },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.repo.count({
      where: {
        userId,
        channel: 'in_app',
        readAt: IsNull(),
        status: Not('failed'),
      },
    });
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.repo.update(
      { userId, channel: 'in_app', readAt: IsNull() },
      { readAt: new Date(), status: 'read' },
    );
    return result.affected || 0;
  }
}
