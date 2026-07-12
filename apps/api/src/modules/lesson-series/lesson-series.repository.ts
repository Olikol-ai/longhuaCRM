import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { LessonSeriesEntity } from './entities/lesson-series.entity';

@Injectable()
export class LessonSeriesRepository {
  constructor(
    @InjectRepository(LessonSeriesEntity)
    private readonly repo: Repository<LessonSeriesEntity>,
  ) {}

  findAll(): Promise<LessonSeriesEntity[]> {
    return this.repo.find({ order: { startDate: 'DESC' } });
  }

  findById(id: string): Promise<LessonSeriesEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  save(entity: Partial<LessonSeriesEntity>): Promise<LessonSeriesEntity> {
    return this.repo.save(this.repo.create(entity));
  }

  filter(where: FindOptionsWhere<LessonSeriesEntity>): Promise<LessonSeriesEntity[]> {
    return this.repo.find({ where, order: { startDate: 'DESC' } });
  }
}
