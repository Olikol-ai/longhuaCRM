import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  ContentLifecycleStatus,
  QuestionType,
} from '../../assessment/enums';
import { QuestionAuthoringService } from '../../assessment/services/question-authoring.service';
import {
  CONTENT_KIND,
  CONTENT_STATUS,
} from '../constants';
import {
  ExamAcademyContentGrammarEntity,
  ExamAcademyContentItemEntity,
  ExamAcademyContentVocabularyEntity,
  ExamAcademyLevelEntity,
  ExamAcademyProgramVersionEntity,
} from '../entities';

export type BankListFilter = {
  versionId?: string;
  levelId?: string;
  sectionKey?: string;
  status?: string;
  search?: string;
};

export type CreateBankItemInput = {
  versionId: string;
  levelId: string;
  sectionKey: string;
  itemTypeCode?: string;
  topic?: string | null;
  difficulty?: number;
  recommendedTimeSeconds?: number | null;
  stem: string;
  explanation?: string | null;
  options: Array<{ text: string; isCorrect: boolean }>;
  vocabulary?: Array<{
    word: string;
    pinyin?: string | null;
    translation?: string | null;
    explanation?: string | null;
  }>;
  grammar?: Array<{ pattern: string; explanation?: string | null }>;
  publish?: boolean;
};

@Injectable()
export class ExamAcademyBankService {
  constructor(
    @InjectRepository(ExamAcademyContentItemEntity)
    private readonly contentItems: Repository<ExamAcademyContentItemEntity>,
    @InjectRepository(ExamAcademyContentVocabularyEntity)
    private readonly vocabulary: Repository<ExamAcademyContentVocabularyEntity>,
    @InjectRepository(ExamAcademyContentGrammarEntity)
    private readonly grammar: Repository<ExamAcademyContentGrammarEntity>,
    @InjectRepository(ExamAcademyLevelEntity)
    private readonly levels: Repository<ExamAcademyLevelEntity>,
    @InjectRepository(ExamAcademyProgramVersionEntity)
    private readonly versions: Repository<ExamAcademyProgramVersionEntity>,
    private readonly questions: QuestionAuthoringService,
    private readonly access: AssessmentAccessService,
  ) {}

  private assertTeacher(actor: DomainAccessActor): void {
    if (this.access.isAdmin(actor) || this.access.isTeacher(actor) || this.access.isTutor(actor)) {
      return;
    }
    throw new ForbiddenException('Только преподаватель может управлять банком HSK Academy');
  }

  async list(actor: DomainAccessActor, filter: BankListFilter) {
    this.assertTeacher(actor);
    const where: Record<string, unknown> = {};
    if (filter.versionId) where.versionId = filter.versionId;
    if (filter.levelId) where.levelId = filter.levelId;
    if (filter.sectionKey) where.sectionKey = filter.sectionKey;
    if (filter.status) where.status = filter.status;

    const rows = await this.contentItems.find({
      where,
      order: { updatedAt: 'DESC' },
      take: 200,
      relations: { vocabulary: true, grammar: true, level: true, version: true },
    });

    if (!filter.search) return rows;
    const q = filter.search.trim().toLowerCase();
    // Stem lives in Assessment — filter by topic/section for list; full search via topic
    return rows.filter(
      (row) =>
        (row.topic || '').toLowerCase().includes(q) ||
        row.sectionKey.toLowerCase().includes(q) ||
        (row.vocabulary || []).some((v) => v.word.toLowerCase().includes(q)),
    );
  }

  async get(actor: DomainAccessActor, id: string) {
    this.assertTeacher(actor);
    const item = await this.contentItems.findOne({
      where: { id },
      relations: { vocabulary: true, grammar: true, level: true, version: true },
    });
    if (!item) throw new NotFoundException('Задание не найдено');
    const question =
      item.contentKind === CONTENT_KIND.Question
        ? await this.questions.findById(item.contentId)
        : null;
    return { item, question };
  }

  async create(actor: DomainAccessActor, input: CreateBankItemInput) {
    this.assertTeacher(actor);
    const version = await this.versions.findOne({ where: { id: input.versionId } });
    if (!version) throw new NotFoundException('Version not found');
    const level = await this.levels.findOne({ where: { id: input.levelId } });
    if (!level) throw new NotFoundException('Level not found');
    if (level.versionId !== version.id) {
      throw new BadRequestException('Level does not belong to version');
    }
    if (!input.options?.length) {
      throw new BadRequestException('Нужны варианты ответа');
    }
    if (!input.options.some((o) => o.isCorrect)) {
      throw new BadRequestException('Отметьте правильный ответ');
    }

    const question = await this.questions.create(actor, {
      type: QuestionType.SingleChoice,
      stem: input.stem.trim(),
      points: 1,
      difficulty: input.difficulty ?? 1,
      explanation: input.explanation ?? null,
      answers: input.options.map((o, idx) => ({
        text: o.text,
        isCorrect: o.isCorrect,
        sortOrder: idx,
      })),
      createdByUserId: actor.sub,
    });

    if (input.publish) {
      await this.questions.publish(actor, question.id);
    }

    const content = await this.contentItems.save({
      contentKind: CONTENT_KIND.Question,
      contentId: question.id,
      programId: version.programId,
      versionId: version.id,
      levelId: level.id,
      sectionKey: input.sectionKey,
      itemTypeCode: input.itemTypeCode || 'single_choice',
      topic: input.topic ?? null,
      difficulty: input.difficulty ?? 1,
      recommendedTimeSeconds: input.recommendedTimeSeconds ?? 45,
      authorUserId: actor.sub,
      status: input.publish ? CONTENT_STATUS.Published : CONTENT_STATUS.Draft,
      revision: 1,
      supersedesItemId: null,
      publishedAt: input.publish ? new Date() : null,
    });

    if (input.vocabulary?.length) {
      await this.vocabulary.save(
        input.vocabulary.map((v, idx) =>
          this.vocabulary.create({
            contentItemId: content.id,
            word: v.word,
            pinyin: v.pinyin ?? null,
            translation: v.translation ?? null,
            explanation: v.explanation ?? null,
            sortOrder: idx,
          }),
        ),
      );
    }
    if (input.grammar?.length) {
      await this.grammar.save(
        input.grammar.map((g, idx) =>
          this.grammar.create({
            contentItemId: content.id,
            pattern: g.pattern,
            explanation: g.explanation ?? null,
            sortOrder: idx,
          }),
        ),
      );
    }

    return this.get(actor, content.id);
  }

  async publish(actor: DomainAccessActor, id: string) {
    this.assertTeacher(actor);
    const item = await this.contentItems.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Задание не найдено');
    if (item.contentKind === CONTENT_KIND.Question) {
      const q = await this.questions.findById(item.contentId);
      if (q && q.status === ContentLifecycleStatus.Draft) {
        await this.questions.publish(actor, item.contentId);
      }
    }
    item.status = CONTENT_STATUS.Published;
    item.publishedAt = item.publishedAt ?? new Date();
    await this.contentItems.save(item);
    return this.get(actor, id);
  }

  async archive(actor: DomainAccessActor, id: string) {
    this.assertTeacher(actor);
    const item = await this.contentItems.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Задание не найдено');
    if (item.contentKind === CONTENT_KIND.Question) {
      try {
        await this.questions.archive(actor, item.contentId);
      } catch {
        // still archive academy metadata
      }
    }
    item.status = CONTENT_STATUS.Archived;
    await this.contentItems.save(item);
    return { ok: true };
  }

  async updateMeta(
    actor: DomainAccessActor,
    id: string,
    patch: {
      topic?: string | null;
      difficulty?: number;
      sectionKey?: string;
      recommendedTimeSeconds?: number | null;
      vocabulary?: CreateBankItemInput['vocabulary'];
    },
  ) {
    this.assertTeacher(actor);
    const item = await this.contentItems.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Задание не найдено');
    if (item.status === CONTENT_STATUS.Published) {
      throw new BadRequestException(
        'Опубликованное задание неизменяемо. Создайте новую ревизию через новое задание.',
      );
    }
    if (patch.topic !== undefined) item.topic = patch.topic;
    if (patch.difficulty !== undefined) item.difficulty = patch.difficulty;
    if (patch.sectionKey !== undefined) item.sectionKey = patch.sectionKey;
    if (patch.recommendedTimeSeconds !== undefined) {
      item.recommendedTimeSeconds = patch.recommendedTimeSeconds;
    }
    await this.contentItems.save(item);

    if (patch.vocabulary) {
      await this.vocabulary.delete({ contentItemId: id });
      await this.vocabulary.save(
        patch.vocabulary.map((v, idx) =>
          this.vocabulary.create({
            contentItemId: id,
            word: v.word,
            pinyin: v.pinyin ?? null,
            translation: v.translation ?? null,
            explanation: v.explanation ?? null,
            sortOrder: idx,
          }),
        ),
      );
    }
    return this.get(actor, id);
  }
}
