import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AssessmentBlueprintEntity,
  AssessmentBlueprintSectionRuleEntity,
  AssessmentQuestionEntity,
} from '../entities';
import { ContentLifecycleStatus } from '../enums';
import {
  AssessmentBankRepository,
  AssessmentBlueprintRepository,
  AssessmentExamTemplateRepository,
  AssessmentQuestionRepository,
} from '../repositories';
import { AssessmentContentGuard } from './assessment-content.guard';

export type SectionRuleInput = {
  sectionKey: string;
  title: string;
  questionCount: number;
  questionTypes: string[];
  difficultyMin?: number;
  difficultyMax?: number;
  topicFilter?: string | null;
  topicIds?: string[];
  weight: number | string;
  sortOrder?: number;
};

export type CreateBlueprintInput = {
  examTemplateId: string;
  bankId: string;
  name: string;
  sectionRules?: SectionRuleInput[];
  createdByUserId?: string | null;
};

export type UpdateBlueprintInput = {
  name?: string;
  sectionRules?: SectionRuleInput[];
};

export type BlueprintPreviewSection = {
  sectionKey: string;
  requested: number;
  available: number;
  sampleQuestionIds: string[];
};

export type BlueprintPreviewResult = {
  ok: boolean;
  sections: BlueprintPreviewSection[];
  errors: string[];
};

@Injectable()
export class BlueprintService {
  constructor(
    private readonly blueprints: AssessmentBlueprintRepository,
    private readonly templates: AssessmentExamTemplateRepository,
    private readonly banks: AssessmentBankRepository,
    private readonly questions: AssessmentQuestionRepository,
    private readonly guard: AssessmentContentGuard,
  ) {}

  findById(id: string): Promise<AssessmentBlueprintEntity | null> {
    return this.blueprints.findWithSectionRules(id);
  }

  list(status?: ContentLifecycleStatus): Promise<AssessmentBlueprintEntity[]> {
    return status ? this.blueprints.filterByStatus(status) : this.blueprints.findAll();
  }

  async create(input: CreateBlueprintInput): Promise<AssessmentBlueprintEntity> {
    const template = this.guard.requireFound(
      await this.templates.findById(input.examTemplateId),
      'ExamTemplate',
    );
    this.guard.assertPublished(template.status, 'ExamTemplate');
    this.guard.requireFound(await this.banks.findById(input.bankId), 'Bank');

    const blueprint = await this.blueprints.save({
      examTemplateId: input.examTemplateId,
      bankId: input.bankId,
      name: input.name,
      createdByUserId: input.createdByUserId ?? null,
      status: ContentLifecycleStatus.Draft,
    });

    if (input.sectionRules?.length) {
      await this.blueprints.replaceSectionRules(
        blueprint.id,
        this.mapRules(input.sectionRules),
      );
    }

    return this.guard.requireFound(
      await this.blueprints.findWithSectionRules(blueprint.id),
      'Blueprint',
    );
  }

  async update(id: string, input: UpdateBlueprintInput): Promise<AssessmentBlueprintEntity> {
    const blueprint = this.guard.requireFound(await this.blueprints.findById(id), 'Blueprint');
    this.guard.assertDraft(blueprint.status, 'Blueprint');

    if (input.name !== undefined) {
      await this.blueprints.update(id, { name: input.name });
    }
    if (input.sectionRules) {
      await this.blueprints.replaceSectionRules(id, this.mapRules(input.sectionRules));
    }

    return this.guard.requireFound(await this.blueprints.findWithSectionRules(id), 'Blueprint');
  }

  async publish(id: string): Promise<AssessmentBlueprintEntity> {
    const blueprint = this.guard.requireFound(
      await this.blueprints.findWithSectionRules(id),
      'Blueprint',
    );
    this.guard.assertCanPublish(blueprint.status, 'Blueprint');

    const rules = blueprint.sectionRules ?? [];
    if (rules.length === 0) {
      throw new BadRequestException('Blueprint must have section rules before publish');
    }
    const weightSum = rules.reduce((sum, r) => sum + Number(r.weight), 0);
    if (Math.abs(weightSum - 100) > 0.01) {
      throw new UnprocessableEntityException(
        `Blueprint section weights must sum to 100 (got ${weightSum})`,
      );
    }

    const updated = await this.blueprints.update(id, {
      status: ContentLifecycleStatus.Published,
    });
    return this.guard.requireFound(
      await this.blueprints.findWithSectionRules(updated!.id),
      'Blueprint',
    );
  }

  async archive(id: string): Promise<AssessmentBlueprintEntity> {
    const blueprint = this.guard.requireFound(await this.blueprints.findById(id), 'Blueprint');
    this.guard.assertCanArchive(blueprint.status, 'Blueprint');
    const updated = await this.blueprints.update(id, {
      status: ContentLifecycleStatus.Archived,
    });
    return this.guard.requireFound(updated, 'Blueprint');
  }

  async deleteDraft(id: string): Promise<void> {
    const blueprint = this.guard.requireFound(await this.blueprints.findById(id), 'Blueprint');
    this.guard.assertDraft(blueprint.status, 'Blueprint');
    await this.blueprints.delete(id);
  }

  async preview(id: string, seed?: number): Promise<BlueprintPreviewResult> {
    const blueprint = this.guard.requireFound(
      await this.blueprints.findWithSectionRules(id),
      'Blueprint',
    );
    const rules = blueprint.sectionRules ?? [];
    const pool = await this.questions.findPublishedByBankId(blueprint.bankId);
    const topicMap = await this.loadTopicMap(pool.map((q) => q.id));
    const usedIds = new Set<string>();
    const sections: BlueprintPreviewSection[] = [];
    const errors: string[] = [];

    for (const rule of rules) {
      const candidates = this.findCandidates(pool, rule, usedIds, topicMap);
      const shuffled = this.seededShuffle([...candidates], seed);
      const selected = shuffled.slice(0, rule.questionCount);
      for (const q of selected) {
        usedIds.add(q.id);
      }

      if (selected.length < rule.questionCount) {
        errors.push(
          `Section "${rule.sectionKey}": need ${rule.questionCount}, found ${candidates.length}`,
        );
      }

      sections.push({
        sectionKey: rule.sectionKey,
        requested: rule.questionCount,
        available: candidates.length,
        sampleQuestionIds: selected.map((q) => q.id),
      });
    }

    return {
      ok: errors.length === 0,
      sections,
      errors,
    };
  }

  private findCandidates(
    pool: AssessmentQuestionEntity[],
    rule: AssessmentBlueprintSectionRuleEntity,
    usedIds: Set<string>,
    topicMap: Map<string, string[]>,
  ): AssessmentQuestionEntity[] {
    const types = new Set(rule.questionTypes ?? []);
    const topicFilter = new Set(rule.topicIds ?? []);

    return pool.filter((q) => {
      if (usedIds.has(q.id)) return false;
      if (types.size > 0 && !types.has(q.type)) return false;
      if (q.difficulty < rule.difficultyMin || q.difficulty > rule.difficultyMax) return false;
      if (topicFilter.size > 0) {
        const topics = topicMap.get(q.id) ?? [];
        if (!topics.some((t) => topicFilter.has(t))) return false;
      }
      return true;
    });
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

  private seededShuffle<T>(items: T[], seed?: number): T[] {
    if (seed == null) {
      for (let i = items.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    }

    let state = seed >>> 0;
    const next = (): number => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };

    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  private mapRules(
    rules: SectionRuleInput[],
  ): Partial<AssessmentBlueprintSectionRuleEntity>[] {
    return rules.map((rule, index) => ({
      sectionKey: rule.sectionKey,
      title: rule.title,
      questionCount: rule.questionCount,
      questionTypes: rule.questionTypes,
      difficultyMin: rule.difficultyMin ?? 1,
      difficultyMax: rule.difficultyMax ?? 5,
      topicFilter: rule.topicFilter ?? null,
      topicIds: rule.topicIds ?? [],
      weight: String(rule.weight),
      sortOrder: rule.sortOrder ?? index,
    }));
  }
}
