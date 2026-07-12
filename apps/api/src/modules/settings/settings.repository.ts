import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettingEntity } from './entities/app-setting.entity';

@Injectable()
export class SettingsRepository {
  constructor(
    @InjectRepository(AppSettingEntity)
    private readonly repo: Repository<AppSettingEntity>,
  ) {}

  findAll(): Promise<AppSettingEntity[]> {
    return this.repo.find({ order: { key: 'ASC' } });
  }

  findByKey(key: string): Promise<AppSettingEntity | null> {
    return this.repo.findOne({ where: { key } });
  }

  async upsert(key: string, value: string, description?: string): Promise<AppSettingEntity> {
    const existing = await this.findByKey(key);
    if (existing) {
      existing.value = value;
      if (description !== undefined) {
        existing.description = description;
      }
      return this.repo.save(existing);
    }
    return this.repo.save(
      this.repo.create({ key, value, description: description ?? null }),
    );
  }
}
