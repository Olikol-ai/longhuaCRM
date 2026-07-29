import { ConflictException, BadRequestException, Injectable } from '@nestjs/common';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { JwtPayload } from '../../auth/auth.service';
import {
  AssessmentAnswerEntity,
  AssessmentQuestionAttachmentEntity,
  AssessmentQuestionEntity,
} from '../entities';
import {
  AUTHORING_ATOMIC_QUESTION_TYPES,
  AttachmentKind,
  ContentLifecycleStatus,
  QuestionType,
} from '../enums';
import {
  AssessmentExamBlockRepository,
  AssessmentExamRepository,
  AssessmentQuestionRepository,
} from '../repositories';
import { AssessmentChangeJournalService } from './assessment-change-journal.service';
import { AssessmentContentGuard } from './assessment-content.guard';

export type AnswerInput = {
  text: string;
  isCorrect: boolean;
  sortOrder?: number;
};

export type CreateQuestionInput = {
  type: QuestionType;
  stem: string;
  points?: number | string;
  difficulty?: number;
  explanation?: string | null;
  topicIds?: string[];
  answers?: AnswerInput[];
  createdByUserId?: string | null;
};

export type UpdateQuestionInput = {
  type?: QuestionType;
  stem?: string;
  points?: number | string;
  difficulty?: number;
  explanation?: string | null;
  topicIds?: string[];
  answers?: AnswerInput[];
};

export type ListQuestionsFilter = {
  status?: ContentLifecycleStatus;
  type?: QuestionType;
  topicId?: string;
  difficultyMin?: number;
  difficultyMax?: number;
  search?: string;
};

export type AddAttachmentInput = {
  kind: AttachmentKind;
  storageKey: string;
  mime?: string | null;
  originalFilename?: string | null;
  sortOrder?: number;
};

@Injectable()
export class QuestionAuthoringService {
  constructor(
    private readonly questions: AssessmentQuestionRepository,
    private readonly exams: AssessmentExamRepository,
    private readonly blocks: AssessmentExamBlockRepository,
    private readonly guard: AssessmentContentGuard,
    private readonly access: AssessmentAccessService,
    private readonly journal: AssessmentChangeJournalService,
  ) {}

  findById(id: string): Promise<AssessmentQuestionEntity | null> {
    return this.questions.findByIdWithAnswersAndAttachments(id);
  }

  async getForActor(
    actor: DomainAccessActor,
    id: string,
  ): Promise<AssessmentQuestionEntity> {
    const question = this.guard.requireFound(await this.findById(id), 'Question');
    this.access.assertCanManageCreatedContent(actor, question, 'question');
    return question;
  }

  async listFiltered(
    actor: DomainAccessActor,
    filter: ListQuestionsFilter = {},
  ): Promise<AssessmentQuestionEntity[]> {
    let items = this.access.isAdmin(actor)
      ? await this.questions.findAll()
      : await this.questions.filterByOwner(actor.sub);

    if (filter.status) {
      items = items.filter((q) => q.status === filter.status);
    } else {
      items = items.filter((q) => q.status !== ContentLifecycleStatus.Archived);
    }
    // Test bank never includes legacy reading/listening atomic types.
    items = items.filter((q) => AUTHORING_ATOMIC_QUESTION_TYPES.has(q.type));
    if (filter.type) {
      items = items.filter((q) => q.type === filter.type);
    }
    if (filter.difficultyMin != null) {
      items = items.filter((q) => q.difficulty >= filter.difficultyMin!);
    }
    if (filter.difficultyMax != null) {
      items = items.filter((q) => q.difficulty <= filter.difficultyMax!);
    }
    if (filter.search) {
      const needle = filter.search.toLowerCase();
      items = items.filter((q) => q.stem.toLowerCase().includes(needle));
    }
    if (filter.topicId) {
      const matched: AssessmentQuestionEntity[] = [];
      for (const q of items) {
        const topics = await this.questions.findTopicsByQuestionId(q.id);
        if (topics.some((t) => t.topicId === filter.topicId)) {
          matched.push(q);
        }
      }
      items = matched;
    }

    return Promise.all(
      items.map(async (q) =>
        this.guard.requireFound(await this.questions.findByIdWithAnswers(q.id), 'Question'),
      ),
    );
  }

  async create(
    actor: DomainAccessActor,
    input: CreateQuestionInput,
  ): Promise<AssessmentQuestionEntity> {
    this.access.assertCanManageContent(actor);
    if (!AUTHORING_ATOMIC_QUESTION_TYPES.has(input.type)) {
      throw new BadRequestException(
        'Чтение и аудирование создаются как ReadingTask / ListeningTask, не как вопросы тестового банка',
      );
    }

    const question = await this.questions.save({
      type: input.type,
      stem: input.stem,
      points: String(input.points ?? 1),
      difficulty: input.difficulty ?? 1,
      explanation: input.explanation ?? null,
      createdByUserId: input.createdByUserId ?? actor.sub,
      status: ContentLifecycleStatus.Draft,
    });

    if (input.answers?.length) {
      await this.replaceAnswers(question.id, input.answers);
    }
    if (input.topicIds) {
      await this.questions.setTopics(question.id, input.topicIds);
    }

    const created = this.guard.requireFound(
      await this.questions.findByIdWithAnswers(question.id),
      'Question',
    );
    await this.journal.record({
      actorUserId: actor.sub,
      entityType: 'Question',
      entityId: created.id,
      action: 'create',
      summary: `Created question`,
      newVersion: this.snapshot(created),
    });
    return created;
  }

  async update(
    actor: JwtPayload,
    id: string,
    input: UpdateQuestionInput,
  ): Promise<AssessmentQuestionEntity> {
    const question = this.guard.requireFound(await this.questions.findById(id), 'Question');
    this.access.assertCanMutateQuestion(actor, question);
    this.assertEditable(question);
    const before = this.snapshot(question);

    await this.questions.update(id, {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.stem !== undefined ? { stem: input.stem } : {}),
      ...(input.points !== undefined ? { points: String(input.points) } : {}),
      ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
      ...(input.explanation !== undefined ? { explanation: input.explanation } : {}),
    });

    if (input.answers) {
      await this.replaceAnswers(id, input.answers);
    }
    if (input.topicIds) {
      await this.questions.setTopics(id, input.topicIds);
    }

    const updated = this.guard.requireFound(
      await this.questions.findByIdWithAnswers(id),
      'Question',
    );
    await this.journal.record({
      actorUserId: actor.sub,
      entityType: 'Question',
      entityId: id,
      action: 'update',
      summary: `Updated question`,
      oldVersion: before,
      newVersion: this.snapshot(updated),
    });
    return updated;
  }

  async publish(actor: JwtPayload, id: string): Promise<AssessmentQuestionEntity> {
    const question = this.guard.requireFound(await this.questions.findById(id), 'Question');
    this.access.assertCanMutateQuestion(actor, question);
    if (!AUTHORING_ATOMIC_QUESTION_TYPES.has(question.type)) {
      throw new BadRequestException(
        'Legacy Reading/Listening bank questions cannot be published — use ReadingTask / ListeningTask',
      );
    }
    this.guard.assertCanPublish(question.status, 'Question');
    const before = this.snapshot(question);
    const updated = await this.questions.update(id, {
      status: ContentLifecycleStatus.Published,
    });
    const result = this.guard.requireFound(updated, 'Question');
    await this.journal.record({
      actorUserId: actor.sub,
      entityType: 'Question',
      entityId: id,
      action: 'publish',
      summary: `Published question`,
      oldVersion: before,
      newVersion: this.snapshot(result),
    });
    return result;
  }

  async archive(actor: JwtPayload, id: string): Promise<AssessmentQuestionEntity> {
    const question = this.guard.requireFound(await this.questions.findById(id), 'Question');
    this.access.assertCanMutateQuestion(actor, question);
    this.guard.assertCanArchive(question.status, 'Question');
    const before = this.snapshot(question);
    const updated = await this.questions.update(id, {
      status: ContentLifecycleStatus.Archived,
    });
    const result = this.guard.requireFound(updated, 'Question');
    await this.journal.record({
      actorUserId: actor.sub,
      entityType: 'Question',
      entityId: id,
      action: 'archive',
      summary: `Archived question`,
      oldVersion: before,
      newVersion: this.snapshot(result),
    });
    return result;
  }

  /**
   * Delete a question (admin or author only).
   *
   * - Not linked to any Exam or ExamBlock → physical delete.
   * - Linked → soft-delete via Archive so history and FKs stay intact.
   */
  async deleteQuestion(actor: JwtPayload, id: string): Promise<{ mode: 'hard' | 'soft' }> {
    const question = this.guard.requireFound(await this.questions.findById(id), 'Question');
    this.access.assertCanDeleteQuestion(actor, question);
    const before = this.snapshot(question);

    const usedInExams = await this.exams.isQuestionUsedInExams(id);
    const usedInBlocks = await this.blocks.isQuestionUsedInBlocks(id);
    if (usedInExams || usedInBlocks) {
      if (question.status !== ContentLifecycleStatus.Archived) {
        await this.questions.update(id, {
          status: ContentLifecycleStatus.Archived,
        });
        await this.journal.record({
          actorUserId: actor.sub,
          entityType: 'Question',
          entityId: id,
          action: 'archive',
          summary: `Archived question (in use)`,
          oldVersion: before,
          newVersion: { ...before, status: ContentLifecycleStatus.Archived },
        });
      }
      return { mode: 'soft' };
    }

    try {
      await this.questions.delete(id);
      await this.journal.record({
        actorUserId: actor.sub,
        entityType: 'Question',
        entityId: id,
        action: 'delete',
        summary: `Hard-deleted question`,
        oldVersion: before,
      });
      return { mode: 'hard' };
    } catch {
      if (question.status !== ContentLifecycleStatus.Archived) {
        await this.questions.update(id, {
          status: ContentLifecycleStatus.Archived,
        });
        await this.journal.record({
          actorUserId: actor.sub,
          entityType: 'Question',
          entityId: id,
          action: 'archive',
          summary: `Archived question (delete race)`,
          oldVersion: before,
          newVersion: { ...before, status: ContentLifecycleStatus.Archived },
        });
      }
      return { mode: 'soft' };
    }
  }

  async addAttachment(
    actor: JwtPayload,
    questionId: string,
    input: AddAttachmentInput,
  ): Promise<AssessmentQuestionAttachmentEntity> {
    const question = this.guard.requireFound(await this.questions.findById(questionId), 'Question');
    this.access.assertCanMutateQuestion(actor, question);
    this.assertEditable(question);

    const existing = await this.questions.findAttachmentsByQuestionId(questionId);
    return this.questions.saveAttachment({
      questionId,
      kind: input.kind,
      storageKey: input.storageKey,
      mime: input.mime ?? null,
      originalFilename: input.originalFilename ?? null,
      sortOrder: input.sortOrder ?? existing.length,
    });
  }

  async removeAttachment(
    actor: JwtPayload,
    questionId: string,
    attachmentId: string,
  ): Promise<void> {
    const question = this.guard.requireFound(await this.questions.findById(questionId), 'Question');
    this.access.assertCanMutateQuestion(actor, question);
    this.assertEditable(question);

    const attachment = this.guard.requireFound(
      await this.questions.findAttachmentById(attachmentId),
      'QuestionAttachment',
    );
    if (attachment.questionId !== questionId) {
      throw new ConflictException('Attachment does not belong to this Question');
    }
    await this.questions.deleteAttachment(attachmentId);
  }

  private assertEditable(question: AssessmentQuestionEntity): void {
    if (question.status === ContentLifecycleStatus.Published) {
      throw new ConflictException('Question cannot be edited after publish');
    }
    if (question.status === ContentLifecycleStatus.Archived) {
      throw new ConflictException('Question cannot be modified when archived');
    }
  }

  private snapshot(question: AssessmentQuestionEntity) {
    return {
      id: question.id,
      type: question.type,
      stem: question.stem,
      points: question.points,
      difficulty: question.difficulty,
      status: question.status,
      created_by_user_id: question.createdByUserId,
    };
  }

  private async replaceAnswers(
    questionId: string,
    answers: AnswerInput[],
  ): Promise<AssessmentAnswerEntity[]> {
    await this.questions.deleteAnswersByQuestionId(questionId);
    const saved: AssessmentAnswerEntity[] = [];
    for (let i = 0; i < answers.length; i += 1) {
      const a = answers[i];
      saved.push(
        await this.questions.saveAnswer({
          questionId,
          text: a.text,
          isCorrect: a.isCorrect,
          sortOrder: a.sortOrder ?? i,
        }),
      );
    }
    return saved;
  }
}
