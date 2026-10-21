import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  AssessmentChangeJournalEntity,
  AssessmentResultBreakdownEntity,
  AssessmentResultEntity,
} from '../entities';

export type FinalScoreAuditInsert = {
  actorUserId: string | null;
  summary: string;
  oldVersion: string;
  newVersion: string;
};

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

  /**
   * Optimistic final-score update + required audit row in one transaction.
   * Returns null when another writer changed the score concurrently.
   * If the journal insert fails, the score change is rolled back.
   */
  async updateFinalScoreIfExpected(
    id: string,
    expectedScore: string,
    data: Partial<AssessmentResultEntity>,
    audit: FinalScoreAuditInsert,
  ): Promise<AssessmentResultEntity | null> {
    return this.resultRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(AssessmentResultEntity);
      const journalRepo = manager.getRepository(AssessmentChangeJournalEntity);
      const current = await repo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) {
        return null;
      }
      if (Number(current.score) !== Number(expectedScore)) {
        return null;
      }
      await repo.update({ id }, data);
      const loaded = await repo.findOne({
        where: { id },
        relations: ['breakdowns'],
      });
      if (!loaded) {
        throw new Error(`Result ${id} not found after final-score update`);
      }
      await journalRepo.save(
        journalRepo.create({
          actorUserId: audit.actorUserId,
          entityType: 'assessment_result',
          entityId: id,
          action: 'final_score_adjust',
          summary: audit.summary,
          oldVersion: audit.oldVersion,
          newVersion: audit.newVersion,
        }),
      );
      return loaded;
    });
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
