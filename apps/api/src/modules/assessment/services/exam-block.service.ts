import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  AssessmentExamAssignmentEntity,
  AssessmentExamBlockEntity,
} from '../entities';
import { ContentLifecycleStatus, QuestionBankScope } from '../enums';
import {
  AssessmentExamBlockRepository,
  AssessmentQuestionRepository,
} from '../repositories';
import { AssessmentChangeJournalService } from './assessment-change-journal.service';
import { AssessmentContentGuard } from './assessment-content.guard';

export type CreateExamBlockInput = {
  name: string;
  description?: string | null;
  levelLabel?: string | null;
  durationMinutes?: number | null;
  questionIds?: string[];
  createdByUserId?: string | null;
};

export type UpdateExamBlockInput = {
  name?: string;
  description?: string | null;
  levelLabel?: string | null;
  durationMinutes?: number | null;
  questionIds?: string[];
};

@Injectable()
export class ExamBlockService {
  constructor(
    private readonly blocks: AssessmentExamBlockRepository,
    private readonly questions: AssessmentQuestionRepository,
    @InjectRepository(AssessmentExamAssignmentEntity)
    private readonly assignments: Repository<AssessmentExamAssignmentEntity>,
    private readonly guard: AssessmentContentGuard,
    private readonly access: AssessmentAccessService,
    private readonly journal: AssessmentChangeJournalService,
  ) {}

  async getForActor(
    actor: DomainAccessActor,
    id: string,
  ): Promise<AssessmentExamBlockEntity> {
    const block = this.guard.requireFound(
      await this.blocks.findWithItems(id),
      'ExamBlock',
    );
    this.access.assertCanManageCreatedContent(actor, block, 'exam block');
    return block;
  }

  async listForActor(
    actor: DomainAccessActor,
    status?: ContentLifecycleStatus,
  ): Promise<AssessmentExamBlockEntity[]> {
    const items = status
      ? await this.blocks.filterByStatus(status)
      : await this.blocks.findAll();
    if (this.access.isAdmin(actor)) {
      return items;
    }
    return items.filter((item) => this.access.canManageCreatedContent(actor, item));
  }

  async create(
    actor: DomainAccessActor,
    input: CreateExamBlockInput,
  ): Promise<AssessmentExamBlockEntity> {
    this.access.assertCanManageContent(actor);
    const questionIds = input.questionIds ?? [];
    await this.assertQuestionsUsable(actor, questionIds);

    const block = await this.blocks.save({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      levelLabel: input.levelLabel?.trim() || null,
      durationMinutes: input.durationMinutes ?? null,
      createdByUserId: input.createdByUserId ?? actor.sub,
      status: ContentLifecycleStatus.Draft,
    });
    if (questionIds.length > 0) {
      await this.blocks.replaceItems(block.id, questionIds);
    }

    const created = this.guard.requireFound(
      await this.blocks.findWithItems(block.id),
      'ExamBlock',
    );
    await this.journal.record({
      actorUserId: actor.sub,
      entityType: 'ExamBlock',
      entityId: created.id,
      action: 'create',
      summary: `Created exam block «${created.name}»`,
      newVersion: this.snapshot(created),
    });
    return created;
  }

  async update(
    actor: DomainAccessActor,
    id: string,
    input: UpdateExamBlockInput,
  ): Promise<AssessmentExamBlockEntity> {
    const block = await this.getForActor(actor, id);
    this.guard.assertEditable(block.status, 'ExamBlock');
    const before = this.snapshot(block);

    if (input.questionIds) {
      await this.assertQuestionsUsable(actor, input.questionIds);
      await this.blocks.replaceItems(id, input.questionIds);
    }

    await this.blocks.update(id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.levelLabel !== undefined
        ? { levelLabel: input.levelLabel?.trim() || null }
        : {}),
      ...(input.durationMinutes !== undefined
        ? { durationMinutes: input.durationMinutes }
        : {}),
    });

    const updated = this.guard.requireFound(
      await this.blocks.findWithItems(id),
      'ExamBlock',
    );
    await this.journal.record({
      actorUserId: actor.sub,
      entityType: 'ExamBlock',
      entityId: id,
      action: 'update',
      summary: `Updated exam block «${updated.name}»`,
      oldVersion: before,
      newVersion: this.snapshot(updated),
    });
    return updated;
  }

  async publish(
    actor: DomainAccessActor,
    id: string,
  ): Promise<AssessmentExamBlockEntity> {
    const block = await this.getForActor(actor, id);
    this.guard.assertCanPublish(block.status, 'ExamBlock');
    const items = block.items ?? (await this.blocks.findItemsByBlockId(id));
    if (items.length === 0) {
      throw new BadRequestException('ExamBlock must contain at least one question');
    }
    const before = this.snapshot(block);
    await this.blocks.update(id, { status: ContentLifecycleStatus.Published });
    const updated = this.guard.requireFound(
      await this.blocks.findWithItems(id),
      'ExamBlock',
    );
    await this.journal.record({
      actorUserId: actor.sub,
      entityType: 'ExamBlock',
      entityId: id,
      action: 'publish',
      summary: `Published exam block «${updated.name}»`,
      oldVersion: before,
      newVersion: this.snapshot(updated),
    });
    return updated;
  }

  async archive(
    actor: DomainAccessActor,
    id: string,
  ): Promise<AssessmentExamBlockEntity> {
    const block = await this.getForActor(actor, id);
    this.guard.assertCanArchive(block.status, 'ExamBlock');
    const before = this.snapshot(block);
    await this.blocks.update(id, { status: ContentLifecycleStatus.Archived });
    const updated = this.guard.requireFound(
      await this.blocks.findWithItems(id),
      'ExamBlock',
    );
    await this.journal.record({
      actorUserId: actor.sub,
      entityType: 'ExamBlock',
      entityId: id,
      action: 'archive',
      summary: `Archived exam block «${updated.name}»`,
      oldVersion: before,
      newVersion: this.snapshot(updated),
    });
    return updated;
  }

  async deleteOrArchive(
    actor: DomainAccessActor,
    id: string,
  ): Promise<{ mode: 'hard' | 'soft'; block?: AssessmentExamBlockEntity }> {
    const block = await this.getForActor(actor, id);
    const used = await this.isBlockUsed(id);
    if (used) {
      if (block.status !== ContentLifecycleStatus.Archived) {
        const archived = await this.archive(actor, id);
        return { mode: 'soft', block: archived };
      }
      throw new ConflictException(
        'ExamBlock has usage history and cannot be permanently deleted',
      );
    }
    const before = this.snapshot(block);
    await this.blocks.delete(id);
    await this.journal.record({
      actorUserId: actor.sub,
      entityType: 'ExamBlock',
      entityId: id,
      action: 'delete',
      summary: `Hard-deleted exam block «${block.name}»`,
      oldVersion: before,
    });
    return { mode: 'hard' };
  }

  async isBlockUsed(blockId: string): Promise<boolean> {
    if (await this.blocks.isBlockUsedInExams(blockId)) {
      return true;
    }
    const rows: Array<{ exam_id: string }> = await this.assignments.manager.query(
      `SELECT DISTINCT s.exam_id
       FROM assessment_sections s
       INNER JOIN assessment_attempts a ON a.exam_id = s.exam_id
       WHERE s.source_block_id = $1
       LIMIT 1`,
      [blockId],
    );
    return rows.length > 0;
  }

  private async assertQuestionsUsable(
    actor: DomainAccessActor,
    questionIds: string[],
  ): Promise<void> {
    if (questionIds.length === 0) return;
    const unique = [...new Set(questionIds)];
    const found = await this.questions.findByIdsWithAnswers(unique);
    if (found.length !== unique.length) {
      throw new BadRequestException('One or more questions not found');
    }
    for (const question of found) {
      if (question.status === ContentLifecycleStatus.Archived) {
        throw new BadRequestException(`Question ${question.id} is archived`);
      }
      if (question.bankScope && question.bankScope !== QuestionBankScope.Assessment) {
        throw new BadRequestException(
          `Question ${question.id} принадлежит банку HSK и нельзя использовать в Assessment`,
        );
      }
      this.access.assertCanManageCreatedContent(actor, question, 'question');
    }
  }

  private snapshot(block: AssessmentExamBlockEntity) {
    return {
      id: block.id,
      name: block.name,
      description: block.description,
      level_label: block.levelLabel,
      duration_minutes: block.durationMinutes,
      status: block.status,
      created_by_user_id: block.createdByUserId,
      question_ids: (block.items ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => item.questionId),
    };
  }
}
