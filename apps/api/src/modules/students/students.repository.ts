import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, LessThanOrEqual, Repository } from 'typeorm';
import { StudentEntity } from './entities/student.entity';

/** Active students whose stored lesson_balance is at or below this threshold. */
export const LOW_LESSON_BALANCE_THRESHOLD = 2;

@Injectable()
export class StudentsRepository {
  constructor(
    @InjectRepository(StudentEntity)
    private readonly repo: Repository<StudentEntity>,
  ) {}

  findAll(): Promise<StudentEntity[]> {
    return this.repo.find();
  }

  findById(id: string): Promise<StudentEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Uses persisted Student.lessonBalance (updated by StudentBalanceService).
   * Does not recompute balance from lessons.
   */
  findActiveWithLowBalance(
    maxBalance: number = LOW_LESSON_BALANCE_THRESHOLD,
  ): Promise<StudentEntity[]> {
    return this.repo.find({
      where: {
        status: 'active',
        lessonBalance: LessThanOrEqual(maxBalance),
      },
      order: {
        lessonBalance: 'ASC',
        name: 'ASC',
      },
    });
  }

  save(entity: Partial<StudentEntity>): Promise<StudentEntity> {
    return this.repo.save(this.repo.create(entity));
  }

  async update(id: string, data: Partial<StudentEntity>): Promise<StudentEntity | null> {
    await this.repo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  filter(where: FindOptionsWhere<StudentEntity>): Promise<StudentEntity[]> {
    return this.repo.find({ where });
  }
}
