import { ConflictException, Injectable } from '@nestjs/common';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import { JwtPayload } from '../../auth/auth.service';
import {
  AssessmentAnswerEntity,
  AssessmentQuestionAttachmentEntity,
  AssessmentQuestionEntity,
} from '../entities';
import { AttachmentKind, ContentLifecycleStatus, QuestionType } from '../enums';
import {
  AssessmentBankRepository,
  AssessmentExamRepository,
  AssessmentQuestionRepository,
} from '../repositories';
import { AssessmentContentGuard } from './assessment-content.guard';

export type AnswerInput = {
  text: string;
  isCorrect: boolean;
  sortOrder?: number;
};

export type CreateQuestionInput = {
  bankId: string;
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
  bankId?: string;
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
    private readonly banks: AssessmentBankRepository,
    private readonly exams: AssessmentExamRepository,
    private readonly guard: AssessmentContentGuard,
    private readonly access: AssessmentAccessService,
  ) {}

  findById(id: string): Promise<AssessmentQuestionEntity | null> {
    return this.questions.findByIdWithAnswersAndAttachments(id);
  }

  listByBank(bankId: string): Promise<AssessmentQuestionEntity[]> {
    return this.questions.filterByBankId(bankId);
  }

  async listFiltered(filter: ListQuestionsFilter = {}): Promise<AssessmentQuestionEntity[]> {
    let items = filter.bankId
      ? await this.questions.filterByBankId(filter.bankId)
      : await this.questions.findAll();

    if (filter.status) {
      items = items.filter((q) => q.status === filter.status);
    }
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

  async create(input: CreateQuestionInput): Promise<AssessmentQuestionEntity> {
    const bank = this.guard.requireFound(await this.banks.findById(input.bankId), 'Bank');
    this.guard.assertNotArchived(bank.status, 'Bank');

    const question = await this.questions.save({
      bankId: input.bankId,
      type: input.type,
      stem: input.stem,
      points: String(input.points ?? 1),
      difficulty: input.difficulty ?? 1,
      explanation: input.explanation ?? null,
      createdByUserId: input.createdByUserId ?? null,
      status: ContentLifecycleStatus.Draft,
    });

    if (input.answers?.length) {
      await this.replaceAnswers(question.id, input.answers);
    }
    if (input.topicIds) {
      await this.questions.setTopics(question.id, input.topicIds);
    }

    return this.guard.requireFound(
      await this.questions.findByIdWithAnswers(question.id),
      'Question',
    );
  }

  async update(id: string, input: UpdateQuestionInput): Promise<AssessmentQuestionEntity> {
    const question = this.guard.requireFound(await this.questions.findById(id), 'Question');
    this.assertEditable(question);

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

    return this.guard.requireFound(await this.questions.findByIdWithAnswers(id), 'Question');
  }

  async publish(id: string): Promise<AssessmentQuestionEntity> {
    const question = this.guard.requireFound(await this.questions.findById(id), 'Question');
    this.guard.assertCanPublish(question.status, 'Question');
    const updated = await this.questions.update(id, {
      status: ContentLifecycleStatus.Published,
    });
    return this.guard.requireFound(updated, 'Question');
  }

  async archive(id: string): Promise<AssessmentQuestionEntity> {
    const question = this.guard.requireFound(await this.questions.findById(id), 'Question');
    this.guard.assertCanArchive(question.status, 'Question');
    const updated = await this.questions.update(id, {
      status: ContentLifecycleStatus.Archived,
    });
    return this.guard.requireFound(updated, 'Question');
  }

  /**
   * Delete a question (admin or author only).
   *
   * - Not linked to any Exam → physical delete (answers/topics/attachments cascade).
   * - Linked to Exam(s) → soft-delete via Archive so Snapshot/Attempt history and
   *   exam_questions RESTRICT FK stay intact.
   * Snapshots store stem/answers immutably and do not FK to live questions.
   */
  async deleteQuestion(actor: JwtPayload, id: string): Promise<{ mode: 'hard' | 'soft' }> {
    const question = this.guard.requireFound(await this.questions.findById(id), 'Question');
    this.access.assertCanDeleteQuestion(actor, question);

    const usedInExams = await this.exams.isQuestionUsedInExams(id);
    if (usedInExams) {
      if (question.status !== ContentLifecycleStatus.Archived) {
        await this.questions.update(id, {
          status: ContentLifecycleStatus.Archived,
        });
      }
      return { mode: 'soft' };
    }

    try {
      await this.questions.delete(id);
      return { mode: 'hard' };
    } catch {
      // Race: question linked to an exam between check and delete (RESTRICT).
      if (question.status !== ContentLifecycleStatus.Archived) {
        await this.questions.update(id, {
          status: ContentLifecycleStatus.Archived,
        });
      }
      return { mode: 'soft' };
    }
  }

  async addAttachment(
    questionId: string,
    input: AddAttachmentInput,
  ): Promise<AssessmentQuestionAttachmentEntity> {
    const question = this.guard.requireFound(await this.questions.findById(questionId), 'Question');
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

  async removeAttachment(questionId: string, attachmentId: string): Promise<void> {
    const question = this.guard.requireFound(await this.questions.findById(questionId), 'Question');
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
