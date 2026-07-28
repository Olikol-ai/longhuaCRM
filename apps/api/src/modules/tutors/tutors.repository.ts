import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { TutorEntity } from './entities/tutor.entity';

export const TUTOR_PROFILE_RELATIONS = [
  'learningDirections',
  'teachingLanguages',
  'lessonDurations',
  'workDays',
] as const;

@Injectable()
export class TutorsRepository {
  constructor(
    @InjectRepository(TutorEntity)
    private readonly repo: Repository<TutorEntity>,
  ) {}

  findAll(): Promise<TutorEntity[]> {
    return this.repo.find({ order: { displayName: 'ASC' } });
  }

  findById(id: string): Promise<TutorEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: [...TUTOR_PROFILE_RELATIONS],
    });
  }

  findByUserId(userId: string): Promise<TutorEntity | null> {
    return this.repo.findOne({
      where: { userId },
      relations: [...TUTOR_PROFILE_RELATIONS],
    });
  }

  save(entity: Partial<TutorEntity>): Promise<TutorEntity> {
    return this.repo.save(this.repo.create(entity));
  }

  async update(id: string, data: Partial<TutorEntity>): Promise<TutorEntity | null> {
    await this.repo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  filter(where: FindOptionsWhere<TutorEntity>): Promise<TutorEntity[]> {
    return this.repo.find({ where, order: { displayName: 'ASC' } });
  }
}
