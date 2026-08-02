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
  AssessmentExamEntity,
  AssessmentExamPartEntity,
  AssessmentExamPartPoolItemEntity,
  AssessmentListeningTaskEntity,
  AssessmentQuestionEntity,
  AssessmentReadingTaskEntity,
  AssessmentRuleEntity,
} from '../entities';
import {
  ContentLifecycleStatus,
  PassingMode,
  RetakePolicy,
  ShowCorrectAnswers,
} from '../enums';
import {
  AssessmentExamBlockRepository,
  AssessmentExamRepository,
  AssessmentQuestionRepository,
} from '../repositories';
import { AssessmentChangeJournalService } from './assessment-change-journal.service';
import { AssessmentContentGuard } from './assessment-content.guard';

export type ExamRuleInput = {
  durationMinutes: number;
  maxAttempts?: number;
  allowRetake?: boolean;
  retakePolicy?: RetakePolicy;
  allowReview?: boolean;
  showResultAfterSubmit?: boolean;
  showCorrectAnswers?: ShowCorrectAnswers;
  autoSubmitOnTimeout?: boolean;
  allowPause?: boolean;
  randomizeQuestions?: boolean;
  randomizeAnswers?: boolean;
  passingMode?: PassingMode;
  passScore?: number | string | null;
  passScorePercent?: number | string | null;
  allowNavigation?: boolean;
};

export type CreateExamInput = {
  blockIds?: string[];
  parts?: Array<{
    partKind: 'test' | 'listening' | 'reading';
    title?: string | null;
    selectCount: number;
    pool: Array<{
      questionId?: string;
      readingTaskId?: string;
      listeningTaskId?: string;
    }>;
  }>;
  name: string;
  availableFrom?: Date | null;
  availableTo?: Date | null;
  rule: ExamRuleInput;
  createdByUserId?: string | null;
};

export type UpdateExamInput = {
  name?: string;
  availableFrom?: Date | null;
  availableTo?: Date | null;
  rule?: ExamRuleInput;
};

@Injectable()
export class ExamService {
  constructor(
    private readonly exams: AssessmentExamRepository,
    private readonly blocks: AssessmentExamBlockRepository,
    private readonly questions: AssessmentQuestionRepository,
    @InjectRepository(AssessmentExamAssignmentEntity)
    private readonly assignments: Repository<AssessmentExamAssignmentEntity>,
    @InjectRepository(AssessmentExamPartEntity)
    private readonly parts: Repository<AssessmentExamPartEntity>,
    @InjectRepository(AssessmentExamPartPoolItemEntity)
    private readonly poolItems: Repository<AssessmentExamPartPoolItemEntity>,
    @InjectRepository(AssessmentReadingTaskEntity)
    private readonly readingTasks: Repository<AssessmentReadingTaskEntity>,
    @InjectRepository(AssessmentListeningTaskEntity)
    private readonly listeningTasks: Repository<AssessmentListeningTaskEntity>,
    private readonly guard: AssessmentContentGuard,
    private readonly access: AssessmentAccessService,
    private readonly journal: AssessmentChangeJournalService,
  ) {}

  findById(id: string): Promise<AssessmentExamEntity | null> {
    return this.exams.findWithStructure(id);
  }

  async getForActor(id: string, actor: DomainAccessActor): Promise<AssessmentExamEntity> {
    await this.access.assertCanReadExam(actor, id);
    return this.guard.requireFound(await this.exams.findWithStructure(id), 'Exam');
  }

  list(status?: ContentLifecycleStatus): Promise<AssessmentExamEntity[]> {
    return status ? this.exams.filterByStatus(status) : this.exams.findAll();
  }

  async listForActor(
    actor: DomainAccessActor,
    status?: ContentLifecycleStatus,
  ): Promise<AssessmentExamEntity[]> {
    const items = await this.list(status);
    return this.access.filterReadableExams(actor, items);
  }

  async create(
    input: CreateExamInput,
    actor: DomainAccessActor,
  ): Promise<AssessmentExamEntity> {
    this.access.assertCanManageContent(actor);
    const hasParts = (input.parts?.length ?? 0) > 0;
    const uniqueIds = [...new Set(input.blockIds ?? [])];

    if (!hasParts && uniqueIds.length === 0) {
      throw new BadRequestException('Укажите parts (пулы) или legacy block_ids');
    }

    if (hasParts) {
      return this.createFromParts(input, actor);
    }

    const loaded = await this.blocks.findWithItemsOrdered(uniqueIds);
    if (loaded.length !== uniqueIds.length) {
      throw new BadRequestException('One or more ExamBlocks not found');
    }

    for (const block of loaded) {
      this.access.assertCanManageCreatedContent(actor, block, 'exam block');
      this.guard.assertPublished(block.status, 'ExamBlock');
      const items = block.items ?? [];
      if (items.length === 0) {
        throw new BadRequestException(`ExamBlock «${block.name}» has no questions`);
      }
    }

    const exam = await this.exams.save({
      name: input.name,
      availableFrom: input.availableFrom ?? null,
      availableTo: input.availableTo ?? null,
      createdByUserId: input.createdByUserId ?? actor.sub,
      status: ContentLifecycleStatus.Draft,
    });

    await this.exams.saveRule(this.mapRule(exam.id, input.rule));
    await this.materializeFromBlocks(exam.id, loaded);

    const created = this.guard.requireFound(
      await this.exams.findWithStructure(exam.id),
      'Exam',
    );
    await this.journal.record({
      actorUserId: actor.sub,
      entityType: 'Exam',
      entityId: created.id,
      action: 'create',
      summary: `Created exam «${created.name}» from ${loaded.length} block(s)`,
      newVersion: this.snapshot(created),
    });
    return created;
  }

  private async createFromParts(
    input: CreateExamInput,
    actor: DomainAccessActor,
  ): Promise<AssessmentExamEntity> {
    for (const part of input.parts ?? []) {
      if (part.pool.length < part.selectCount) {
        throw new BadRequestException(
          `Пул части «${part.title ?? part.partKind}» меньше select_count`,
        );
      }
      for (const item of part.pool) {
        if (part.partKind === 'test') {
          if (!item.questionId) {
            throw new BadRequestException('Test part pool requires question_id');
          }
          const q = await this.questions.findById(item.questionId);
          if (!q) throw new BadRequestException(`Question ${item.questionId} not found`);
          this.access.assertCanManageCreatedContent(actor, q, 'question');
        } else if (part.partKind === 'reading') {
          const readingTaskId = item.readingTaskId;
          if (!readingTaskId) {
            throw new BadRequestException('Reading part pool requires reading_task_id');
          }
          const task = await this.readingTasks.findOne({ where: { id: readingTaskId } });
          if (!task) {
            throw new BadRequestException(`Reading task ${readingTaskId} not found`);
          }
          this.access.assertCanManageCreatedContent(actor, task, 'reading task');
        } else {
          const listeningTaskId = item.listeningTaskId;
          if (!listeningTaskId) {
            throw new BadRequestException('Listening part pool requires listening_task_id');
          }
          const task = await this.listeningTasks.findOne({ where: { id: listeningTaskId } });
          if (!task) {
            throw new BadRequestException(`Listening task ${listeningTaskId} not found`);
          }
          this.access.assertCanManageCreatedContent(actor, task, 'listening task');
        }
      }
    }

    const exam = await this.exams.save({
      name: input.name,
      availableFrom: input.availableFrom ?? null,
      availableTo: input.availableTo ?? null,
      createdByUserId: input.createdByUserId ?? actor.sub,
      status: ContentLifecycleStatus.Draft,
    });
    await this.exams.saveRule(this.mapRule(exam.id, input.rule));

    for (const [index, part] of (input.parts ?? []).entries()) {
      const savedPart = await this.parts.save(
        this.parts.create({
          examId: exam.id,
          sortOrder: index,
          partKind: part.partKind,
          title: part.title ?? null,
          selectCount: part.selectCount,
        }),
      );
      await this.poolItems.save(
        part.pool.map((item) =>
          this.poolItems.create({
            partId: savedPart.id,
            questionId: item.questionId ?? null,
            readingTaskId: part.partKind === 'reading' ? (item.readingTaskId ?? null) : null,
            listeningTaskId:
              part.partKind === 'listening' ? (item.listeningTaskId ?? null) : null,
          }),
        ),
      );
    }

    const created = this.guard.requireFound(
      await this.exams.findWithStructure(exam.id),
      'Exam',
    );
    await this.journal.record({
      actorUserId: actor.sub,
      entityType: 'Exam',
      entityId: created.id,
      action: 'create',
      summary: `Created exam «${created.name}» from ${input.parts?.length ?? 0} generation part(s)`,
      newVersion: this.snapshot(created),
    });
    return created;
  }

  async update(
    id: string,
    input: UpdateExamInput,
    actor: DomainAccessActor,
  ): Promise<AssessmentExamEntity> {
    await this.access.assertCanManageExam(actor, id);
    const exam = this.guard.requireFound(await this.exams.findById(id), 'Exam');
    this.guard.assertEditable(exam.status, 'Exam');
    const before = this.snapshot(exam);

    await this.exams.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.availableFrom !== undefined ? { availableFrom: input.availableFrom } : {}),
      ...(input.availableTo !== undefined ? { availableTo: input.availableTo } : {}),
    });

    if (input.rule) {
      const existing = await this.exams.findRuleByExamId(id);
      if (existing) {
        await this.exams.saveRule({
          ...existing,
          ...this.mapRule(id, input.rule),
          id: existing.id,
        });
      } else {
        await this.exams.saveRule(this.mapRule(id, input.rule));
      }
    }

    const updated = this.guard.requireFound(await this.exams.findWithStructure(id), 'Exam');
    await this.journal.record({
      actorUserId: actor.sub,
      entityType: 'Exam',
      entityId: id,
      action: 'update',
      summary: `Updated exam «${updated.name}»`,
      oldVersion: before,
      newVersion: this.snapshot(updated),
    });
    return updated;
  }

  /** Rebuild question pool from source ExamBlocks — draft or published (not archived). */
  async rebuild(id: string, actor: DomainAccessActor): Promise<AssessmentExamEntity> {
    await this.access.assertCanManageExam(actor, id);
    const exam = this.guard.requireFound(await this.exams.findWithStructure(id), 'Exam');
    this.guard.assertEditable(exam.status, 'Exam');

    const orderedIds = (exam.sections ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => s.sourceBlockId)
      .filter((v): v is string => Boolean(v));

    if (orderedIds.length === 0) {
      throw new BadRequestException('Exam has no ExamBlocks to rebuild from');
    }

    const loaded = await this.blocks.findWithItemsOrdered(orderedIds);
    if (loaded.length !== orderedIds.length) {
      throw new BadRequestException('One or more source ExamBlocks not found');
    }
    await this.materializeFromBlocks(exam.id, loaded);

    return this.guard.requireFound(await this.exams.findWithStructure(id), 'Exam');
  }

  async publish(id: string, actor: DomainAccessActor): Promise<AssessmentExamEntity> {
    await this.access.assertCanManageExam(actor, id);
    const exam = this.guard.requireFound(await this.exams.findWithStructure(id), 'Exam');
    this.guard.assertCanPublish(exam.status, 'Exam');
    if (!exam.rule) {
      throw new BadRequestException('Exam requires AssessmentRule before publish');
    }
    const parts = exam.parts ?? [];
    const questions = exam.examQuestions ?? [];
    if (questions.length === 0 && parts.length === 0) {
      throw new BadRequestException('Exam has no questions or generation parts');
    }
    for (const part of parts) {
      const poolSize = part.poolItems?.length ?? 0;
      if (poolSize < 1) {
        throw new BadRequestException(
          `Часть «${part.title ?? part.partKind}» имеет пустой пул`,
        );
      }
      if (poolSize < part.selectCount) {
        throw new BadRequestException(
          `Пул части «${part.title ?? part.partKind}» меньше select_count`,
        );
      }
    }
    const before = this.snapshot(exam);
    const updated = await this.exams.update(id, { status: ContentLifecycleStatus.Published });
    const result = this.guard.requireFound(
      await this.exams.findWithStructure(updated!.id),
      'Exam',
    );
    await this.journal.record({
      actorUserId: actor.sub,
      entityType: 'Exam',
      entityId: id,
      action: 'publish',
      summary: `Published exam «${result.name}»`,
      oldVersion: before,
      newVersion: this.snapshot(result),
    });
    return result;
  }

  async archive(id: string, actor: DomainAccessActor): Promise<AssessmentExamEntity> {
    await this.access.assertCanManageExam(actor, id);
    const exam = this.guard.requireFound(await this.exams.findById(id), 'Exam');
    this.guard.assertCanArchive(exam.status, 'Exam');
    const before = this.snapshot(exam);
    const updated = await this.exams.update(id, { status: ContentLifecycleStatus.Archived });
    const result = this.guard.requireFound(updated, 'Exam');
    await this.journal.record({
      actorUserId: actor.sub,
      entityType: 'Exam',
      entityId: id,
      action: 'archive',
      summary: `Archived exam «${result.name}»`,
      oldVersion: before,
      newVersion: this.snapshot(result),
    });
    return result;
  }

  async deleteOrArchive(
    id: string,
    actor: DomainAccessActor,
  ): Promise<{ mode: 'hard' | 'soft'; exam?: AssessmentExamEntity }> {
    await this.access.assertCanManageExam(actor, id);
    const exam = this.guard.requireFound(await this.exams.findById(id), 'Exam');
    const used = await this.isExamUsed(id);
    if (used) {
      if (exam.status !== ContentLifecycleStatus.Archived) {
        const archived = await this.archive(id, actor);
        return { mode: 'soft', exam: archived };
      }
      throw new ConflictException(
        'Exam has usage history and cannot be permanently deleted',
      );
    }
    const before = this.snapshot(exam);
    await this.exams.delete(id);
    await this.journal.record({
      actorUserId: actor.sub,
      entityType: 'Exam',
      entityId: id,
      action: 'delete',
      summary: `Hard-deleted exam «${exam.name}»`,
      oldVersion: before,
    });
    return { mode: 'hard' };
  }

  async preview(
    id: string,
    actor: DomainAccessActor,
  ): Promise<{
    exam: AssessmentExamEntity;
    sections: Array<{
      sectionKey: string;
      title: string;
      weight: string;
      description: string | null;
      durationMinutes: number | null;
      levelLabel: string | null;
      questions: AssessmentQuestionEntity[];
      selectCount?: number;
      poolSize?: number;
      poolTitles?: string[];
    }>;
  }> {
    await this.access.assertCanManageExam(actor, id);
    const exam = this.guard.requireFound(await this.exams.findWithStructure(id), 'Exam');
    const parts = [...(exam.parts ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    if (parts.length > 0) {
      return {
        exam,
        sections: parts.map((part) => {
          const poolQs: AssessmentQuestionEntity[] = [];
          const poolTitles: string[] = [];
          for (const item of part.poolItems ?? []) {
            if (item.question) poolQs.push(item.question);
            if (item.readingTask) {
              poolTitles.push(item.readingTask.title);
              for (const q of item.readingTask.questions ?? []) {
                poolQs.push({
                  id: q.id,
                  type: q.type,
                  stem: q.stem,
                  points: q.points,
                  difficulty: 1,
                  explanation: q.explanation,
                  status: q.status,
                  createdByUserId: null,
                  answers: q.answers,
                } as AssessmentQuestionEntity);
              }
            }
            if (item.listeningTask) {
              poolTitles.push(item.listeningTask.title);
              for (const q of item.listeningTask.questions ?? []) {
                poolQs.push({
                  id: q.id,
                  type: q.type,
                  stem: q.stem,
                  points: q.points,
                  difficulty: 1,
                  explanation: q.explanation,
                  status: q.status,
                  createdByUserId: null,
                  answers: q.answers,
                } as AssessmentQuestionEntity);
              }
            }
          }
          return {
            sectionKey: part.partKind,
            title: part.title || part.partKind,
            weight: '0',
            description: `Пул: ${part.poolItems?.length ?? 0}, выбирается: ${part.selectCount}`,
            durationMinutes: null,
            levelLabel: null,
            questions: poolQs,
            selectCount: part.selectCount,
            poolSize: part.poolItems?.length ?? 0,
            poolTitles,
          };
        }),
      };
    }

    const questionIds = [...new Set((exam.examQuestions ?? []).map((eq) => eq.questionId))];
    const loaded = await this.questions.findByIdsWithAnswers(questionIds);
    const byId = new Map(loaded.map((q) => [q.id, q]));

    const sections = (exam.sections ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((section) => {
        const sectionQuestionIds = (exam.examQuestions ?? [])
          .filter((eq) => eq.sectionId === section.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((eq) => eq.questionId);
        const questions = sectionQuestionIds
          .map((qid) => byId.get(qid))
          .filter((q): q is AssessmentQuestionEntity => Boolean(q));
        return {
          sectionKey: section.sectionKey,
          title: section.title,
          weight: String(section.weight),
          description: section.description,
          durationMinutes: section.durationMinutes,
          levelLabel: section.levelLabel,
          questions,
        };
      });

    return { exam, sections };
  }

  private async isExamUsed(examId: string): Promise<boolean> {
    const assignmentCount = await this.assignments.count({ where: { examId } });
    if (assignmentCount > 0) return true;
    const rows: Array<{ id: string }> = await this.assignments.manager.query(
      `SELECT id FROM assessment_attempts WHERE exam_id = $1 LIMIT 1`,
      [examId],
    );
    return rows.length > 0;
  }

  private async materializeFromBlocks(
    examId: string,
    blocks: AssessmentExamBlockEntity[],
  ): Promise<void> {
    if (blocks.length === 0) {
      throw new BadRequestException('No ExamBlocks to materialize');
    }

    const weightEach = (100 / blocks.length).toFixed(2);
    const sectionsSpec = blocks.map((block, index) => {
      const items = (block.items ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return {
        sectionKey: `block_${index + 1}`,
        title: block.name,
        description: block.description,
        durationMinutes: block.durationMinutes,
        levelLabel: block.levelLabel,
        sourceBlockId: block.id,
        weight: weightEach,
        sortOrder: index,
        questionIds: items.map((item) => item.questionId),
      };
    });

    const savedStructure = await this.exams.replaceSectionsAndQuestions(
      examId,
      sectionsSpec.map((s) => ({
        sectionKey: s.sectionKey,
        title: s.title,
        description: s.description,
        durationMinutes: s.durationMinutes,
        levelLabel: s.levelLabel,
        sourceBlockId: s.sourceBlockId,
        weight: s.weight,
        sortOrder: s.sortOrder,
      })),
      [],
    );

    const sectionByKey = new Map(savedStructure.sections.map((s) => [s.sectionKey, s]));
    const examQuestions = sectionsSpec.flatMap((s) => {
      const section = sectionByKey.get(s.sectionKey);
      if (!section) {
        throw new ConflictException(`Failed to materialize block section ${s.sectionKey}`);
      }
      return s.questionIds.map((questionId, index) => ({
        examId,
        sectionId: section.id,
        questionId,
        sortOrder: index,
      }));
    });

    await this.exams.replaceExamQuestions(examId, examQuestions);
  }

  private snapshot(exam: AssessmentExamEntity) {
    return {
      id: exam.id,
      name: exam.name,
      status: exam.status,
      created_by_user_id: exam.createdByUserId,
      available_from: exam.availableFrom,
      available_to: exam.availableTo,
    };
  }

  private mapRule(examId: string, rule: ExamRuleInput): Partial<AssessmentRuleEntity> {
    return {
      examId,
      durationMinutes: rule.durationMinutes,
      maxAttempts: rule.maxAttempts ?? 1,
      allowRetake: rule.allowRetake ?? false,
      retakePolicy: rule.retakePolicy ?? RetakePolicy.Last,
      allowReview: rule.allowReview ?? false,
      showResultAfterSubmit: rule.showResultAfterSubmit ?? true,
      showCorrectAnswers: rule.showCorrectAnswers ?? ShowCorrectAnswers.Never,
      autoSubmitOnTimeout: rule.autoSubmitOnTimeout ?? true,
      allowPause: rule.allowPause ?? false,
      randomizeQuestions: rule.randomizeQuestions ?? false,
      randomizeAnswers: rule.randomizeAnswers ?? false,
      passingMode: rule.passingMode ?? PassingMode.Percent,
      passScore: rule.passScore != null ? String(rule.passScore) : null,
      passScorePercent: rule.passScorePercent != null ? String(rule.passScorePercent) : null,
      allowNavigation: rule.allowNavigation ?? true,
    };
  }
}
