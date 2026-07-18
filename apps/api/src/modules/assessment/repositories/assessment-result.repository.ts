import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AssessmentResultBreakdownEntity, AssessmentResultEntity } from '../entities';

@Injectable()
export class AssessmentResultRepository {
  constructor(
    @InjectRepository(AssessmentResultEntity)
    private readonly resultRepo: Repository<AssessmentResultEntity>,
    @InjectRepository(AssessmentResultBreakdownEntity)
    private readonly breakdownRepo: Repository<AssessmentResultBreakdownEntity>,
  ) {}

  findAll(): Promise<AssessmentResultEntity[]> {
    return this.resultRepo.find({ order: { createdAt: 'DESC' } });
  }

  findById(id: string): Promise<AssessmentResultEntity | null> {
    return this.resultRepo.findOne({ where: { id } });
  }

  findByAttemptId(attemptId: string): Promise<AssessmentResultEntity | null> {
    return this.resultRepo.findOne({
      where: { attemptId },
      relations: ['breakdowns'],
    });
  }

  filter(where: FindOptionsWhere<AssessmentResultEntity>): Promise<AssessmentResultEntity[]> {
    return this.resultRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  filterByExamId(examId: string): Promise<AssessmentResultEntity[]> {
    return this.filter({ examId });
  }

  save(entity: Partial<AssessmentResultEntity>): Promise<AssessmentResultEntity> {
    return this.resultRepo.save(this.resultRepo.create(entity));
  }

  async update(
    id: string,
    data: Partial<AssessmentResultEntity>,
  ): Promise<AssessmentResultEntity | null> {
    await this.resultRepo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.resultRepo.delete({ id });
  }

  async saveWithBreakdowns(
    result: Partial<AssessmentResultEntity>,
    breakdowns: Partial<AssessmentResultBreakdownEntity>[],
  ): Promise<AssessmentResultEntity> {
    return this.resultRepo.manager.transaction(async (manager) => {
      const resultRepo = manager.getRepository(AssessmentResultEntity);
      const breakdownRepo = manager.getRepository(AssessmentResultBreakdownEntity);

      const savedResult = await resultRepo.save(resultRepo.create(result));

      await breakdownRepo.delete({ resultId: savedResult.id });

      if (breakdowns.length > 0) {
        await breakdownRepo.save(
          breakdowns.map((breakdown) =>
            breakdownRepo.create({ ...breakdown, resultId: savedResult.id }),
          ),
        );
      }

      const loaded = await resultRepo.findOne({
        where: { id: savedResult.id },
        relations: ['breakdowns'],
      });

      return loaded ?? savedResult;
    });
  }

  async updateWithBreakdowns(
    id: string,
    data: Partial<AssessmentResultEntity>,
    breakdowns: Partial<AssessmentResultBreakdownEntity>[],
  ): Promise<AssessmentResultEntity> {
    return this.resultRepo.manager.transaction(async (manager) => {
      const resultRepo = manager.getRepository(AssessmentResultEntity);
      const breakdownRepo = manager.getRepository(AssessmentResultBreakdownEntity);

      await resultRepo.update({ id }, data);
      await breakdownRepo.delete({ resultId: id });

      if (breakdowns.length > 0) {
        await breakdownRepo.save(
          breakdowns.map((breakdown) =>
            breakdownRepo.create({ ...breakdown, resultId: id }),
          ),
        );
      }

      const loaded = await resultRepo.findOne({
        where: { id },
        relations: ['breakdowns'],
      });

      if (!loaded) {
        throw new Error(`Result ${id} not found after update`);
      }
      return loaded;
    });
  }

  findBreakdownsByResultId(resultId: string): Promise<AssessmentResultBreakdownEntity[]> {
    return this.breakdownRepo.find({
      where: { resultId },
      order: { sectionKey: 'ASC' },
    });
  }
}
