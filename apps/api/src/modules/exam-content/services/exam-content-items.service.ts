import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { QuestionType } from '../../assessment/enums';
import { QuestionAuthoringService } from '../../assessment/services/question-authoring.service';
import { CONTENT_STATUS } from '../constants';
import {
  ExamContentItemEntity,
  ExamContentItemGrammarEntity,
  ExamContentItemStatsEntity,
  ExamContentItemVocabularyEntity,
  ExamContentLevelEntity,
  ExamContentProgramVersionEntity,
  ExamContentSectionEntity,
} from '../entities';
import { ExamContentAccessService } from './exam-content-access.service';
import { ExamContentChangeLogService } from './exam-content-change-log.service';

export type ItemSearchFilter = {
  programId?: string;
  versionId?: string;
  levelId?: string;
  sectionKey?: string;
  subsectionId?: string;
  topicId?: string;
  subtopicId?: string;
  itemTypeCode?: string;
  difficultyMin?: number;
  difficultyMax?: number;
  authorUserId?: string;
  editorUserId?: string;
  status?: string;
  hasImage?: boolean;
  hasAudio?: boolean;
  hasVideo?: boolean;
  hasPdf?: boolean;
  vocabularyWord?: string;
  grammarPattern?: string;
  search?: string;
};

export type CreateItemInput = {
  versionId: string;
  levelId: string;
  sectionKey: string;
  sectionId?: string | null;
  subsectionId?: string | null;
  topicId?: string | null;
  subtopicId?: string | null;
  groupId?: string | null;
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
  mediaAssetIds?: string[];
};

@Injectable()
export class ExamContentItemsService {
  constructor(
    @InjectRepository(ExamContentItemEntity)
    private readonly items: Repository<ExamContentItemEntity>,
    @InjectRepository(ExamContentItemVocabularyEntity)
    private readonly vocabulary: Repository<ExamContentItemVocabularyEntity>,
    @InjectRepository(ExamContentItemGrammarEntity)
    private readonly grammar: Repository<ExamContentItemGrammarEntity>,
    @InjectRepository(ExamContentItemStatsEntity)
    private readonly stats: Repository<ExamContentItemStatsEntity>,
    @InjectRepository(ExamContentLevelEntity)
    private readonly levels: Repository<ExamContentLevelEntity>,
    @InjectRepository(ExamContentProgramVersionEntity)
    private readonly versions: Repository<ExamContentProgramVersionEntity>,
    @InjectRepository(ExamContentSectionEntity)
    private readonly sections: Repository<ExamContentSectionEntity>,
    private readonly questions: QuestionAuthoringService,
    private readonly access: ExamContentAccessService,
    private readonly changeLog: ExamContentChangeLogService,
  ) {}

  async search(actor: DomainAccessActor, filter: ItemSearchFilter) {
    this.access.assertStaff(actor);
    const qb = this.items
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.vocabulary', 'v')
      .leftJoinAndSelect('i.grammar', 'g')
      .leftJoinAndSelect('i.media', 'm')
      .leftJoinAndSelect('m.asset', 'ma')
      .orderBy('i.updatedAt', 'DESC')
      .take(300);

    if (filter.programId) qb.andWhere('i.program_id = :programId', { programId: filter.programId });
    if (filter.versionId) qb.andWhere('i.version_id = :versionId', { versionId: filter.versionId });
    if (filter.levelId) qb.andWhere('i.level_id = :levelId', { levelId: filter.levelId });
    if (filter.sectionKey) qb.andWhere('i.section_key = :sectionKey', { sectionKey: filter.sectionKey });
    if (filter.subsectionId) {
      qb.andWhere('i.subsection_id = :subsectionId', { subsectionId: filter.subsectionId });
    }
    if (filter.topicId) qb.andWhere('i.topic_id = :topicId', { topicId: filter.topicId });
    if (filter.subtopicId) qb.andWhere('i.subtopic_id = :subtopicId', { subtopicId: filter.subtopicId });
    if (filter.itemTypeCode) {
      qb.andWhere('i.item_type_code = :itemTypeCode', { itemTypeCode: filter.itemTypeCode });
    }
    if (filter.status) qb.andWhere('i.status = :status', { status: filter.status });
    if (filter.authorUserId) {
      qb.andWhere('i.author_user_id = :authorUserId', { authorUserId: filter.authorUserId });
    }
    if (filter.editorUserId) {
      qb.andWhere('i.editor_user_id = :editorUserId', { editorUserId: filter.editorUserId });
    }
    if (filter.difficultyMin != null) {
      qb.andWhere('i.difficulty >= :difficultyMin', { difficultyMin: filter.difficultyMin });
    }
    if (filter.difficultyMax != null) {
      qb.andWhere('i.difficulty <= :difficultyMax', { difficultyMax: filter.difficultyMax });
    }
    if (filter.vocabularyWord) {
      qb.andWhere('v.word ILIKE :vw', { vw: `%${filter.vocabularyWord}%` });
    }
    if (filter.grammarPattern) {
      qb.andWhere('g.pattern ILIKE :gp', { gp: `%${filter.grammarPattern}%` });
    }
    if (filter.search) {
      qb.andWhere(
        '(i.stem_search ILIKE :q OR i.topic ILIKE :q OR v.word ILIKE :q)',
        { q: `%${filter.search}%` },
      );
    }
    if (filter.hasImage) qb.andWhere(`ma.kind = 'image'`);
    if (filter.hasAudio) qb.andWhere(`ma.kind = 'audio'`);
    if (filter.hasVideo) qb.andWhere(`ma.kind = 'video'`);
    if (filter.hasPdf) qb.andWhere(`ma.kind = 'pdf'`);

    return qb.getMany();
  }

  async get(actor: DomainAccessActor, id: string) {
    this.access.assertStaff(actor);
    const item = await this.items.findOne({
      where: { id },
      relations: { vocabulary: true, grammar: true, media: true, level: true },
    });
    if (!item) throw new NotFoundException('Item not found');
    const question =
      item.contentKind === 'question'
        ? await this.questions.findById(item.engineContentId)
        : null;
    const stats = await this.stats.findOne({ where: { itemId: id } });
    return { item, question, stats };
  }

  async create(actor: DomainAccessActor, input: CreateItemInput) {
    this.access.assertStaff(actor);
    const version = await this.versions.findOne({ where: { id: input.versionId } });
    if (!version) throw new NotFoundException('Version not found');
    const level = await this.levels.findOne({ where: { id: input.levelId } });
    if (!level) throw new NotFoundException('Level not found');
    if (level.versionId !== version.id) {
      throw new BadRequestException('Level does not belong to version');
    }
    if (!input.options?.length) throw new BadRequestException('Нужны варианты ответа');
    if (!input.options.some((o) => o.isCorrect)) {
      throw new BadRequestException('Отметьте правильный ответ');
    }

    let sectionId = input.sectionId ?? null;
    if (!sectionId && input.sectionKey) {
      const section = await this.sections.findOne({
        where: { levelId: level.id, sectionKey: input.sectionKey },
      });
      sectionId = section?.id ?? null;
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

    const item = await this.items.save({
      contentKind: 'question',
      engineContentId: question.id,
      programId: version.programId,
      versionId: version.id,
      levelId: level.id,
      sectionId,
      sectionKey: input.sectionKey,
      subsectionId: input.subsectionId ?? null,
      topicId: input.topicId ?? null,
      subtopicId: input.subtopicId ?? null,
      groupId: input.groupId ?? null,
      itemTypeCode: input.itemTypeCode || 'single_choice',
      topic: input.topic ?? null,
      difficulty: input.difficulty ?? 1,
      recommendedTimeSeconds: input.recommendedTimeSeconds ?? 45,
      stemSearch: input.stem.trim(),
      status: CONTENT_STATUS.Draft,
      revision: 1,
      supersedesItemId: null,
      editionFamilyId: null,
      authorUserId: actor.sub,
      editorUserId: actor.sub,
      reviewedByUserId: null,
      reviewedAt: null,
      publishedAt: null,
      externalId: null,
    });
    await this.items.update(item.id, { editionFamilyId: item.id });

    if (input.vocabulary?.length) {
      await this.vocabulary.save(
        input.vocabulary.map((v, idx) =>
          this.vocabulary.create({
            itemId: item.id,
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
            itemId: item.id,
            pattern: g.pattern,
            explanation: g.explanation ?? null,
            sortOrder: idx,
          }),
        ),
      );
    }

    await this.stats.save({
      itemId: item.id,
      timesUsed: 0,
      timesAnswered: 0,
      timesCorrect: 0,
      timesWrong: 0,
      avgAnswerTimeMs: null,
      lastUsedAt: null,
      difficultyIndex: null,
      discriminationIndex: null,
    });

    await this.changeLog.record({
      entityType: 'item',
      entityId: item.id,
      actorUserId: actor.sub,
      action: 'create',
      summary: 'Created item draft',
      afterRevision: 1,
    });

    return this.get(actor, item.id);
  }

  async update(
    actor: DomainAccessActor,
    id: string,
    input: Partial<CreateItemInput> & { stem?: string; explanation?: string | null },
  ) {
    this.access.assertStaff(actor);
    const item = await this.items.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');
    if (item.status === CONTENT_STATUS.Published || item.status === CONTENT_STATUS.Archived) {
      throw new BadRequestException(
        'Published/archived item нельзя править на месте. Создайте новую ревизию (rollback/clone).',
      );
    }

    if (input.stem != null || input.explanation !== undefined || input.options || input.difficulty != null) {
      await this.questions.update(actor, item.engineContentId, {
        ...(input.stem != null ? { stem: input.stem.trim() } : {}),
        ...(input.explanation !== undefined ? { explanation: input.explanation } : {}),
        ...(input.difficulty != null ? { difficulty: input.difficulty } : {}),
        ...(input.options
          ? {
              answers: input.options.map((o, idx) => ({
                text: o.text,
                isCorrect: o.isCorrect,
                sortOrder: idx,
              })),
            }
          : {}),
      });
    }

    const before = item.revision;
    Object.assign(item, {
      ...(input.sectionKey != null ? { sectionKey: input.sectionKey } : {}),
      ...(input.sectionId !== undefined ? { sectionId: input.sectionId } : {}),
      ...(input.subsectionId !== undefined ? { subsectionId: input.subsectionId } : {}),
      ...(input.topicId !== undefined ? { topicId: input.topicId } : {}),
      ...(input.subtopicId !== undefined ? { subtopicId: input.subtopicId } : {}),
      ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
      ...(input.itemTypeCode != null ? { itemTypeCode: input.itemTypeCode } : {}),
      ...(input.topic !== undefined ? { topic: input.topic } : {}),
      ...(input.difficulty != null ? { difficulty: input.difficulty } : {}),
      ...(input.recommendedTimeSeconds !== undefined
        ? { recommendedTimeSeconds: input.recommendedTimeSeconds }
        : {}),
      ...(input.stem != null ? { stemSearch: input.stem.trim() } : {}),
      editorUserId: actor.sub,
      revision: item.revision + 1,
    });
    await this.items.save(item);

    if (input.vocabulary) {
      await this.vocabulary.delete({ itemId: id });
      if (input.vocabulary.length) {
        await this.vocabulary.save(
          input.vocabulary.map((v, idx) =>
            this.vocabulary.create({
              itemId: id,
              word: v.word,
              pinyin: v.pinyin ?? null,
              translation: v.translation ?? null,
              explanation: v.explanation ?? null,
              sortOrder: idx,
            }),
          ),
        );
      }
    }
    if (input.grammar) {
      await this.grammar.delete({ itemId: id });
      if (input.grammar.length) {
        await this.grammar.save(
          input.grammar.map((g, idx) =>
            this.grammar.create({
              itemId: id,
              pattern: g.pattern,
              explanation: g.explanation ?? null,
              sortOrder: idx,
            }),
          ),
        );
      }
    }

    await this.changeLog.record({
      entityType: 'item',
      entityId: id,
      actorUserId: actor.sub,
      action: 'update',
      summary: 'Updated item draft',
      beforeRevision: before,
      afterRevision: item.revision,
    });
    return this.get(actor, id);
  }

  async setStatus(actor: DomainAccessActor, id: string, status: string) {
    this.access.assertStaff(actor);
    const item = await this.items.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');

    if (status === CONTENT_STATUS.Published) {
      await this.access.assertCanPublish(actor);
      if (item.contentKind === 'question') {
        await this.questions.publish(actor, item.engineContentId);
      }
      item.publishedAt = new Date();
    } else if (status === CONTENT_STATUS.InReview) {
      item.reviewedByUserId = null;
      item.reviewedAt = null;
    } else if (status === CONTENT_STATUS.Archived) {
      await this.access.assertCanPublish(actor);
    }

    const before = item.status;
    item.status = status;
    item.editorUserId = actor.sub;
    await this.items.save(item);
    await this.changeLog.record({
      entityType: 'item',
      entityId: id,
      actorUserId: actor.sub,
      action: 'status_change',
      summary: `${before} → ${status}`,
      afterRevision: item.revision,
    });
    return this.get(actor, id);
  }

  /** Ephemeral preview — does not persist to bank. */
  async preview(actor: DomainAccessActor, draft: CreateItemInput) {
    this.access.assertStaff(actor);
    if (!draft.stem?.trim()) throw new BadRequestException('stem обязателен');
    if (!draft.options?.length) throw new BadRequestException('Нужны варианты');
    return {
      mode: 'preview',
      itemTypeCode: draft.itemTypeCode || 'single_choice',
      stem: draft.stem.trim(),
      explanation: draft.explanation ?? null,
      options: draft.options.map((o, idx) => ({
        id: `preview-${idx}`,
        text: o.text,
        isCorrect: o.isCorrect,
        sortOrder: idx,
      })),
      vocabulary: draft.vocabulary || [],
      grammar: draft.grammar || [],
      meta: {
        levelId: draft.levelId,
        sectionKey: draft.sectionKey,
        difficulty: draft.difficulty ?? 1,
        recommendedTimeSeconds: draft.recommendedTimeSeconds ?? 45,
      },
    };
  }

  history(actor: DomainAccessActor, id: string) {
    this.access.assertStaff(actor);
    return this.changeLog.listForEntity('item', id);
  }

  async rollback(actor: DomainAccessActor, id: string) {
    this.access.assertStaff(actor);
    const source = await this.items.findOne({
      where: { id },
      relations: { vocabulary: true, grammar: true },
    });
    if (!source) throw new NotFoundException('Item not found');
    const question = await this.questions.findById(source.engineContentId);
    if (!question) throw new NotFoundException('Engine question missing');

    const answers = (question.answers || []).map((a, idx) => ({
      text: a.text,
      isCorrect: a.isCorrect,
      sortOrder: idx,
    }));

    const created = await this.create(actor, {
      versionId: source.versionId,
      levelId: source.levelId,
      sectionKey: source.sectionKey,
      sectionId: source.sectionId,
      subsectionId: source.subsectionId,
      topicId: source.topicId,
      subtopicId: source.subtopicId,
      itemTypeCode: source.itemTypeCode,
      topic: source.topic,
      difficulty: source.difficulty,
      recommendedTimeSeconds: source.recommendedTimeSeconds,
      stem: question.stem,
      explanation: question.explanation,
      options: answers.length
        ? answers
        : [{ text: '—', isCorrect: true }],
      vocabulary: (source.vocabulary || []).map((v) => ({
        word: v.word,
        pinyin: v.pinyin,
        translation: v.translation,
        explanation: v.explanation,
      })),
      grammar: (source.grammar || []).map((g) => ({
        pattern: g.pattern,
        explanation: g.explanation,
      })),
    });

    const newItem = created.item;
    newItem.supersedesItemId = source.id;
    newItem.editionFamilyId = source.editionFamilyId || source.id;
    await this.items.save(newItem);
    await this.changeLog.record({
      entityType: 'item',
      entityId: newItem.id,
      actorUserId: actor.sub,
      action: 'rollback',
      summary: `Cloned from ${source.id} as new revision`,
      beforeRevision: source.revision,
      afterRevision: 1,
    });
    return this.get(actor, newItem.id);
  }

  async getStats(actor: DomainAccessActor, id: string) {
    this.access.assertStaff(actor);
    const row = await this.stats.findOne({ where: { itemId: id } });
    if (!row) throw new NotFoundException('Stats not found');
    return row;
  }
}
