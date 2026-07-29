import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import {
  AssessmentExamBlockEntity,
  AssessmentExamBlockItemEntity,
} from '../entities';
import { ContentLifecycleStatus } from '../enums';

@Injectable()
export class AssessmentExamBlockRepository {
  constructor(
    @InjectRepository(AssessmentExamBlockEntity)
    private readonly blocks: Repository<AssessmentExamBlockEntity>,
    @InjectRepository(AssessmentExamBlockItemEntity)
    private readonly items: Repository<AssessmentExamBlockItemEntity>,
  ) {}

  findAll(): Promise<AssessmentExamBlockEntity[]> {
    return this.blocks.find({
      order: { updatedAt: 'DESC' },
      relations: ['items'],
    });
  }

  findById(id: string): Promise<AssessmentExamBlockEntity | null> {
    return this.blocks.findOne({ where: { id } });
  }

  findByIds(ids: string[]): Promise<AssessmentExamBlockEntity[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.blocks.find({ where: { id: In(ids) } });
  }

  findWithItems(id: string): Promise<AssessmentExamBlockEntity | null> {
    return this.blocks.findOne({
      where: { id },
      relations: ['items', 'items.question', 'items.question.answers'],
    });
  }

  /** Load blocks with items, preserving the requested id order. */
  async findWithItemsOrdered(ids: string[]): Promise<AssessmentExamBlockEntity[]> {
    if (ids.length === 0) return [];
    const unique = [...new Set(ids)];
    const rows = await this.blocks.find({
      where: { id: In(unique) },
      relations: ['items'],
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids
      .map((id) => byId.get(id))
      .filter((row): row is AssessmentExamBlockEntity => Boolean(row));
  }

  filter(where: FindOptionsWhere<AssessmentExamBlockEntity>): Promise<AssessmentExamBlockEntity[]> {
    return this.blocks.find({
      where,
      order: { updatedAt: 'DESC' },
      relations: ['items'],
    });
  }

  filterByStatus(status: ContentLifecycleStatus): Promise<AssessmentExamBlockEntity[]> {
    return this.filter({ status });
  }

  save(entity: Partial<AssessmentExamBlockEntity>): Promise<AssessmentExamBlockEntity> {
    return this.blocks.save(
      this.blocks.create({ status: ContentLifecycleStatus.Draft, ...entity }),
    );
  }

  async update(
    id: string,
    data: Partial<AssessmentExamBlockEntity>,
  ): Promise<AssessmentExamBlockEntity | null> {
    await this.blocks.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.blocks.delete({ id });
  }

  findItemsByBlockId(blockId: string): Promise<AssessmentExamBlockItemEntity[]> {
    return this.items.find({
      where: { blockId },
      order: { sortOrder: 'ASC' },
      relations: ['question', 'question.answers'],
    });
  }

  async replaceItems(
    blockId: string,
    questionIds: string[],
  ): Promise<AssessmentExamBlockItemEntity[]> {
    await this.items.delete({ blockId });
    if (questionIds.length === 0) return [];
    return this.items.save(
      questionIds.map((questionId, index) =>
        this.items.create({
          blockId,
          questionId,
          sortOrder: index,
        }),
      ),
    );
  }

  async isQuestionUsedInBlocks(questionId: string): Promise<boolean> {
    const count = await this.items.count({ where: { questionId } });
    return count > 0;
  }

  async isBlockUsedInExams(blockId: string): Promise<boolean> {
    const rows = await this.blocks.manager.query(
      `SELECT 1 FROM assessment_sections WHERE source_block_id = $1 LIMIT 1`,
      [blockId],
    );
    return Array.isArray(rows) && rows.length > 0;
  }
}
