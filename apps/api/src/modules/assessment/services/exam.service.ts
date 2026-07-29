import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  AssessmentBlueprintSectionRuleEntity,
  AssessmentExamEntity,
  AssessmentQuestionEntity,
  AssessmentRuleEntity,
} from '../entities';
import {
  ContentLifecycleStatus,
  PassingMode,
  RetakePolicy,
  ShowCorrectAnswers,
} from '../enums';
import {
  AssessmentBlueprintRepository,
  AssessmentExamRepository,
  AssessmentQuestionRepository,
} from '../repositories';
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
  blueprintId: string;
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
    private readonly blueprints: AssessmentBlueprintRepository,
    private readonly questions: AssessmentQuestionRepository,
    private readonly guard: AssessmentContentGuard,
    private readonly access: AssessmentAccessService,
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

  async createFromBlueprint(
    input: CreateExamInput,
    actor: DomainAccessActor,
  ): Promise<AssessmentExamEntity> {
    this.access.assertCanManageContent(actor);
    const blueprint = this.guard.requireFound(await this.blueprints.findWithSectionRules(input.blueprintId), 'Blueprint');
    this.access.assertCanManageCreatedContent(actor, blueprint, 'blueprint');
    this.guard.assertPublished(blueprint.status, 'Blueprint');

    const exam = await this.exams.save({
      blueprintId: blueprint.id,
      name: input.name,
      availableFrom: input.availableFrom ?? null,
      availableTo: input.availableTo ?? null,
      createdByUserId: input.createdByUserId ?? actor.sub,
      status: ContentLifecycleStatus.Draft,
    });

    await this.exams.saveRule(this.mapRule(exam.id, input.rule));
    await this.materializeFromBlueprint(exam.id, blueprint.id, blueprint.bankId);

    return this.guard.requireFound(await this.exams.findWithStructure(exam.id), 'Exam');
  }

  async update(
    id: string,
    input: UpdateExamInput,
    actor: DomainAccessActor,
  ): Promise<AssessmentExamEntity> {
    await this.access.assertCanManageExam(actor, id);
    const exam = this.guard.requireFound(await this.exams.findById(id), 'Exam');
    this.guard.assertDraft(exam.status, 'Exam');

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

    return this.guard.requireFound(await this.exams.findWithStructure(id), 'Exam');
  }

  /** Rebuild question pool from Blueprint — draft only. */
  async rebuild(id: string, actor: DomainAccessActor): Promise<AssessmentExamEntity> {
    await this.access.assertCanManageExam(actor, id);
    const exam = this.guard.requireFound(await this.exams.findById(id), 'Exam');
    this.guard.assertDraft(exam.status, 'Exam');
    const blueprint = this.guard.requireFound(
      await this.blueprints.findWithSectionRules(exam.blueprintId),
      'Blueprint',
    );
    await this.materializeFromBlueprint(exam.id, blueprint.id, blueprint.bankId);
    return this.guard.requireFound(await this.exams.findWithStructure(id), 'Exam');
  }

  async publish(id: string, actor: DomainAccessActor): Promise<AssessmentExamEntity> {
    await this.access.assertCanManageExam(actor, id);
    const exam = this.guard.requireFound(await this.exams.findWithStructure(id), 'Exam');
    this.guard.assertCanPublish(exam.status, 'Exam');
    if (!exam.rule) {
      throw new BadRequestException('Exam requires AssessmentRule before publish');
    }
    const questions = exam.examQuestions ?? [];
    if (questions.length === 0) {
      throw new BadRequestException('Exam has no questions; rebuild from Blueprint first');
    }
    const updated = await this.exams.update(id, { status: ContentLifecycleStatus.Published });
    return this.guard.requireFound(await this.exams.findWithStructure(updated!.id), 'Exam');
  }

  async archive(id: string, actor: DomainAccessActor): Promise<AssessmentExamEntity> {
    await this.access.assertCanManageExam(actor, id);
    const exam = this.guard.requireFound(await this.exams.findById(id), 'Exam');
    this.guard.assertCanArchive(exam.status, 'Exam');
    const updated = await this.exams.update(id, { status: ContentLifecycleStatus.Archived });
    return this.guard.requireFound(updated, 'Exam');
  }

  async preview(
    id: string,
    actor: DomainAccessActor,
  ): Promise<{
    exam: AssessmentExamEntity;
    sections: Array<{
      sectionKey: string;
      weight: string;
      questions: AssessmentQuestionEntity[];
    }>;
  }> {
    await this.access.assertCanManageExam(actor, id);
    const exam = this.guard.requireFound(await this.exams.findWithStructure(id), 'Exam');
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
          weight: String(section.weight),
          questions,
        };
      });

    return { exam, sections };
  }

  private async materializeFromBlueprint(
    examId: string,
    blueprintId: string,
    bankId: string,
  ): Promise<void> {
    const rules = await this.blueprints.findSectionRulesByBlueprintId(blueprintId);
    if (rules.length === 0) {
      throw new BadRequestException('Blueprint has no section rules');
    }

    const pool = await this.questions.findPublishedByBankId(bankId);
    const topicMap = await this.loadTopicMap(pool.map((q) => q.id));
    const usedIds = new Set<string>();

    const sections: Array<{
      sectionKey: string;
      title: string;
      weight: string;
      sortOrder: number;
      questionIds: string[];
    }> = [];

    for (let i = 0; i < rules.length; i += 1) {
      const rule = rules[i];
      const selected = this.selectQuestions(pool, rule, usedIds, topicMap);
      if (selected.length < rule.questionCount) {
        throw new UnprocessableEntityException(
          `Insufficient questions for section "${rule.sectionKey}": need ${rule.questionCount}, found ${selected.length}`,
        );
      }
      for (const q of selected) {
        usedIds.add(q.id);
      }
      sections.push({
        sectionKey: rule.sectionKey,
        title: rule.title,
        weight: String(rule.weight),
        sortOrder: rule.sortOrder ?? i,
        questionIds: selected.map((q) => q.id),
      });
    }

    const savedStructure = await this.exams.replaceSectionsAndQuestions(
      examId,
      sections.map((s) => ({
        sectionKey: s.sectionKey,
        title: s.title,
        weight: s.weight,
        sortOrder: s.sortOrder,
      })),
      [],
    );

    const sectionByKey = new Map(savedStructure.sections.map((s) => [s.sectionKey, s]));
    const examQuestions = sections.flatMap((s) => {
      const section = sectionByKey.get(s.sectionKey);
      if (!section) {
        throw new ConflictException(`Failed to materialize section ${s.sectionKey}`);
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

  private selectQuestions(
    pool: AssessmentQuestionEntity[],
    rule: AssessmentBlueprintSectionRuleEntity,
    usedIds: Set<string>,
    topicMap: Map<string, string[]>,
  ): AssessmentQuestionEntity[] {
    const types = new Set(rule.questionTypes ?? []);
    const topicFilter = new Set(rule.topicIds ?? []);

    const candidates = pool.filter((q) => {
      if (usedIds.has(q.id)) return false;
      if (types.size > 0 && !types.has(q.type)) return false;
      if (q.difficulty < rule.difficultyMin || q.difficulty > rule.difficultyMax) return false;
      if (topicFilter.size > 0) {
        const topics = topicMap.get(q.id) ?? [];
        if (!topics.some((t) => topicFilter.has(t))) return false;
      }
      return true;
    });

    this.shuffleInPlace(candidates);
    return candidates.slice(0, rule.questionCount);
  }

  private async loadTopicMap(questionIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    for (const id of questionIds) {
      const rows = await this.questions.findTopicsByQuestionId(id);
      map.set(
        id,
        rows.map((r) => r.topicId),
      );
    }
    return map;
  }

  private shuffleInPlace<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
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
