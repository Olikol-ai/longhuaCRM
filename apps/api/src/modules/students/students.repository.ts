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

  countActive(): Promise<number> {
    return this.repo.count({ where: { status: 'active' } });
  }

  countActiveWithLowBalance(
    maxBalance: number = LOW_LESSON_BALANCE_THRESHOLD,
  ): Promise<number> {
    return this.repo.count({
      where: {
        status: 'active',
        lessonBalance: LessThanOrEqual(maxBalance),
      },
    });
  }

  /** Active students with a birthday set (for dashboard upcoming birthdays). */
  findActiveWithBirthday(): Promise<StudentEntity[]> {
    return this.repo
      .createQueryBuilder('s')
      .where('s.status = :status', { status: 'active' })
      .andWhere('s.birthday IS NOT NULL')
      .orderBy('s.name', 'ASC')
      .getMany();
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
