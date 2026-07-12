import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { NotificationEntity } from './entities/notification.entity';

@Injectable()
export class NotificationsRepository {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repo: Repository<NotificationEntity>,
  ) {}

  findAll(): Promise<NotificationEntity[]> {
    return this.repo.find();
  }

  findById(id: string): Promise<NotificationEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  save(entity: Partial<NotificationEntity>): Promise<NotificationEntity> {
    return this.repo.save(this.repo.create(entity));
  }

  async update(id: string, data: Partial<NotificationEntity>): Promise<NotificationEntity | null> {
    await this.repo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  filter(where: FindOptionsWhere<NotificationEntity>): Promise<NotificationEntity[]> {
    return this.repo.find({ where });
  }
}
