import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ANSWER_SHAPE,
  CATALOG_STATUS,
  CONTENT_STATUS,
  ENGINE_ADAPTER,
  PASSING_MODE,
} from '../constants';
import {
  ExamAcademyAchievementEntity,
  ExamAcademyItemTypeEntity,
  ExamAcademyLevelEntity,
  ExamAcademyMockBlueprintEntity,
  ExamAcademyMockBlueprintSectionEntity,
  ExamAcademyProgramEntity,
  ExamAcademyProgramVersionEntity,
  ExamAcademyScoringProfileEntity,
  ExamAcademyScoringProfileSectionEntity,
  ExamAcademySectionTemplateEntity,
  ExamAcademySectionTemplateItemTypeEntity,
} from '../entities';

/**
 * Idempotent catalog seed for HSK 2.0 / 3.0 constructor data + item types.
 */
@Injectable()
export class ExamAcademyCatalogSeedService implements OnModuleInit {
  private readonly logger = new Logger(ExamAcademyCatalogSeedService.name);

  constructor(
    @InjectRepository(ExamAcademyProgramEntity)
    private readonly programs: Repository<ExamAcademyProgramEntity>,
    @InjectRepository(ExamAcademyProgramVersionEntity)
    private readonly versions: Repository<ExamAcademyProgramVersionEntity>,
    @InjectRepository(ExamAcademyLevelEntity)
    private readonly levels: Repository<ExamAcademyLevelEntity>,
    @InjectRepository(ExamAcademyItemTypeEntity)
    private readonly itemTypes: Repository<ExamAcademyItemTypeEntity>,
    @InjectRepository(ExamAcademySectionTemplateEntity)
    private readonly sections: Repository<ExamAcademySectionTemplateEntity>,
    @InjectRepository(ExamAcademySectionTemplateItemTypeEntity)
    private readonly sectionItemTypes: Repository<ExamAcademySectionTemplateItemTypeEntity>,
    @InjectRepository(ExamAcademyScoringProfileEntity)
    private readonly scoringProfiles: Repository<ExamAcademyScoringProfileEntity>,
    @InjectRepository(ExamAcademyScoringProfileSectionEntity)
    private readonly scoringSections: Repository<ExamAcademyScoringProfileSectionEntity>,
    @InjectRepository(ExamAcademyMockBlueprintEntity)
    private readonly blueprints: Repository<ExamAcademyMockBlueprintEntity>,
    @InjectRepository(ExamAcademyMockBlueprintSectionEntity)
    private readonly blueprintSections: Repository<ExamAcademyMockBlueprintSectionEntity>,
    @InjectRepository(ExamAcademyAchievementEntity)
    private readonly achievements: Repository<ExamAcademyAchievementEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seed();
    } catch (err) {
      this.logger.warn(`Exam Academy catalog seed skipped: ${String(err)}`);
    }
  }

  async seed(): Promise<void> {
    await this.seedItemTypes();
    await this.seedAchievements();

    let program = await this.programs.findOne({ where: { code: 'hsk' } });
    if (!program) {
      program = await this.programs.save({
        code: 'hsk',
        title: 'HSK',
        status: CATALOG_STATUS.Active,
      });
    }

    const v20 = await this.ensureVersion(program.id, 'hsk_2_0', 'HSK Version 2.0', 1);
    const v30 = await this.ensureVersion(program.id, 'hsk_3_0', 'HSK Version 3.0', 2);

    for (let n = 1; n <= 6; n += 1) {
      const level = await this.ensureLevel(v20.id, `hsk_${n}`, `HSK ${n}`, n);
      await this.ensureHsk20Sections(level, n);
      await this.ensureDefaultScoringAndBlueprint(level, n);
    }

    // HSK 3.0 bands — constructor placeholders ready for content
    const bands = [
      { code: 'hsk3_band1', title: 'HSK 3.0 Band 1', sort: 1 },
      { code: 'hsk3_band2', title: 'HSK 3.0 Band 2', sort: 2 },
      { code: 'hsk3_band3', title: 'HSK 3.0 Band 3', sort: 3 },
    ];
    for (const band of bands) {
      const level = await this.ensureLevel(v30.id, band.code, band.title, band.sort);
      await this.ensureHsk30Sections(level);
      await this.ensureDefaultScoringAndBlueprint(level, band.sort);
    }

    this.logger.log('Exam Academy catalog seed complete');
  }

  private async seedItemTypes(): Promise<void> {
    const rows = [
      {
        code: 'single_choice',
        title: 'Один вариант',
        engineAdapter: ENGINE_ADAPTER.Question,
        engineQuestionType: 'single_choice',
        answerShape: ANSWER_SHAPE.Choice,
        supportsAutoGrade: true,
        rendererKey: 'single_choice',
        sortOrder: 1,
      },
      {
        code: 'multiple_choice',
        title: 'Несколько вариантов',
        engineAdapter: ENGINE_ADAPTER.Question,
        engineQuestionType: 'multiple_choice',
        answerShape: ANSWER_SHAPE.MultiChoice,
        supportsAutoGrade: true,
        rendererKey: 'multiple_choice',
        sortOrder: 2,
      },
      {
        code: 'listening_task',
        title: 'Аудирование (задание)',
        engineAdapter: ENGINE_ADAPTER.ListeningTask,
        engineQuestionType: null,
        answerShape: ANSWER_SHAPE.Composite,
        supportsAutoGrade: true,
        rendererKey: 'listening_task',
        sortOrder: 3,
      },
      {
        code: 'reading_task',
        title: 'Чтение (задание)',
        engineAdapter: ENGINE_ADAPTER.ReadingTask,
        engineQuestionType: null,
        answerShape: ANSWER_SHAPE.Composite,
        supportsAutoGrade: true,
        rendererKey: 'reading_task',
        sortOrder: 4,
      },
      {
        code: 'short_text',
        title: 'Краткий ответ',
        engineAdapter: ENGINE_ADAPTER.Question,
        engineQuestionType: 'short_text',
        answerShape: ANSWER_SHAPE.Text,
        supportsAutoGrade: false,
        rendererKey: 'short_text',
        sortOrder: 5,
      },
      {
        code: 'cloze',
        title: 'Пропуски',
        engineAdapter: ENGINE_ADAPTER.Question,
        engineQuestionType: 'cloze',
        answerShape: ANSWER_SHAPE.Text,
        supportsAutoGrade: true,
        rendererKey: 'cloze',
        sortOrder: 6,
      },
      {
        code: 'matching',
        title: 'Сопоставление',
        engineAdapter: ENGINE_ADAPTER.Question,
        engineQuestionType: 'matching',
        answerShape: ANSWER_SHAPE.Choice,
        supportsAutoGrade: true,
        rendererKey: 'matching',
        sortOrder: 7,
      },
      {
        code: 'writing_prompt',
        title: 'Письменная часть',
        engineAdapter: ENGINE_ADAPTER.ManualPrompt,
        engineQuestionType: 'translation',
        answerShape: ANSWER_SHAPE.Text,
        supportsAutoGrade: false,
        rendererKey: 'writing_prompt',
        sortOrder: 8,
      },
      {
        code: 'speaking_prompt',
        title: 'Устная часть',
        engineAdapter: ENGINE_ADAPTER.ManualPrompt,
        engineQuestionType: 'speaking',
        answerShape: ANSWER_SHAPE.Audio,
        supportsAutoGrade: false,
        rendererKey: 'speaking_prompt',
        sortOrder: 9,
      },
    ];

    for (const row of rows) {
      const existing = await this.itemTypes.findOne({ where: { code: row.code } });
      if (!existing) {
        await this.itemTypes.save({ ...row, status: CATALOG_STATUS.Active });
      }
    }
  }

  private async seedAchievements(): Promise<void> {
    const rows = [
      { code: 'first_practice', title: 'Первая тренировка', description: 'Завершите первую тренировку', sortOrder: 1 },
      { code: 'first_mock', title: 'Первый пробный экзамен', description: 'Завершите пробный экзамен', sortOrder: 2 },
      { code: 'streak_3', title: '3 дня подряд', description: 'Занимайтесь 3 дня подряд', sortOrder: 3 },
      { code: 'score_80', title: '80%+', description: 'Наберите 80% на пробном экзамене', sortOrder: 4 },
    ];
    for (const row of rows) {
      const existing = await this.achievements.findOne({ where: { code: row.code } });
      if (!existing) {
        await this.achievements.save({
          ...row,
          iconKey: row.code,
          status: CATALOG_STATUS.Active,
        });
      }
    }
  }

  private async ensureVersion(
    programId: string,
    code: string,
    title: string,
    sortOrder: number,
  ): Promise<ExamAcademyProgramVersionEntity> {
    let row = await this.versions.findOne({ where: { code } });
    if (!row) {
      row = await this.versions.save({
        programId,
        code,
        title,
        sortOrder,
        status: CATALOG_STATUS.Active,
      });
    }
    return row;
  }

  private async ensureLevel(
    versionId: string,
    code: string,
    title: string,
    sortOrder: number,
  ): Promise<ExamAcademyLevelEntity> {
    let row = await this.levels.findOne({ where: { versionId, code } });
    if (!row) {
      row = await this.levels.save({
        versionId,
        code,
        title,
        sortOrder,
        status: CATALOG_STATUS.Active,
      });
    }
    return row;
  }

  private async ensureHsk20Sections(level: ExamAcademyLevelEntity, n: number): Promise<void> {
    const hasWriting = n >= 3;
    const specs = [
      {
        sectionKey: 'listening',
        title: 'Аудирование',
        sortOrder: 1,
        duration: n <= 2 ? 15 * 60 : 35 * 60,
        weight: hasWriting ? 40 : 50,
        types: ['listening_task', 'single_choice'],
      },
      {
        sectionKey: 'reading',
        title: 'Чтение',
        sortOrder: 2,
        duration: n <= 2 ? 15 * 60 : 40 * 60,
        weight: hasWriting ? 30 : 50,
        types: ['reading_task', 'single_choice'],
      },
    ];
    if (hasWriting) {
      specs.push({
        sectionKey: 'writing',
        title: 'Письмо',
        sortOrder: 3,
        duration: 25 * 60,
        weight: 30,
        types: ['writing_prompt', 'short_text'],
      });
    }
    for (const spec of specs) {
      await this.ensureSection(level.id, spec);
    }
  }

  private async ensureHsk30Sections(level: ExamAcademyLevelEntity): Promise<void> {
    const specs = [
      {
        sectionKey: 'listening',
        title: 'Аудирование',
        sortOrder: 1,
        duration: 30 * 60,
        weight: 35,
        types: ['listening_task', 'single_choice'],
      },
      {
        sectionKey: 'reading',
        title: 'Чтение',
        sortOrder: 2,
        duration: 40 * 60,
        weight: 35,
        types: ['reading_task', 'single_choice'],
      },
      {
        sectionKey: 'writing',
        title: 'Письмо',
        sortOrder: 3,
        duration: 30 * 60,
        weight: 30,
        types: ['writing_prompt', 'short_text'],
      },
    ];
    for (const spec of specs) {
      await this.ensureSection(level.id, spec);
    }
  }

  private async ensureSection(
    levelId: string,
    spec: {
      sectionKey: string;
      title: string;
      sortOrder: number;
      duration: number;
      weight: number;
      types: string[];
    },
  ): Promise<ExamAcademySectionTemplateEntity> {
    let section = await this.sections.findOne({
      where: { levelId, sectionKey: spec.sectionKey },
    });
    if (!section) {
      section = await this.sections.save({
        levelId,
        sectionKey: spec.sectionKey,
        title: spec.title,
        sortOrder: spec.sortOrder,
        defaultDurationSeconds: spec.duration,
        defaultWeightPercent: String(spec.weight),
      });
    }
    for (let i = 0; i < spec.types.length; i += 1) {
      const itemTypeCode = spec.types[i];
      const existing = await this.sectionItemTypes.findOne({
        where: { sectionTemplateId: section.id, itemTypeCode },
      });
      if (!existing) {
        await this.sectionItemTypes.save({
          sectionTemplateId: section.id,
          itemTypeCode,
          sortOrder: i + 1,
        });
      }
    }
    return section;
  }

  private async ensureDefaultScoringAndBlueprint(
    level: ExamAcademyLevelEntity,
    sortHint: number,
  ): Promise<void> {
    let profile = await this.scoringProfiles.findOne({
      where: { levelId: level.id, code: 'default' },
    });
    if (!profile) {
      profile = await this.scoringProfiles.save({
        levelId: level.id,
        code: 'default',
        title: `Сcoring ${level.title}`,
        passingMode: PASSING_MODE.Percent,
        passScore: null,
        passScorePercent: '60',
        graderKind: 'auto',
        autoGrade: true,
        status: CATALOG_STATUS.Active,
      });
    }

    const sectionRows = await this.sections.find({
      where: { levelId: level.id },
      order: { sortOrder: 'ASC' },
    });
    for (const section of sectionRows) {
      const existing = await this.scoringSections.findOne({
        where: { scoringProfileId: profile.id, sectionKey: section.sectionKey },
      });
      if (!existing) {
        await this.scoringSections.save({
          scoringProfileId: profile.id,
          sectionKey: section.sectionKey,
          weightPercent: section.defaultWeightPercent,
          minimumPercent: null,
          sortOrder: section.sortOrder,
        });
      }
    }

    let blueprint = await this.blueprints.findOne({
      where: { levelId: level.id, name: `${level.title} Mock` },
    });
    if (!blueprint) {
      const totalDuration = sectionRows.reduce(
        (sum, s) => sum + (s.defaultDurationSeconds || 0),
        0,
      );
      blueprint = await this.blueprints.save({
        levelId: level.id,
        scoringProfileId: profile.id,
        name: `${level.title} Mock`,
        status: CONTENT_STATUS.Published,
        revision: 1,
        totalDurationSeconds: totalDuration || 40 * 60,
        supersedesBlueprintId: null,
      });
      for (const section of sectionRows) {
        const selectCount =
          section.sectionKey === 'listening'
            ? Math.min(10, 4 + sortHint)
            : section.sectionKey === 'reading'
              ? Math.min(15, 5 + sortHint)
              : 2;
        await this.blueprintSections.save({
          blueprintId: blueprint.id,
          sectionTemplateId: section.id,
          selectCount,
          sortOrder: section.sortOrder,
          durationSeconds: section.defaultDurationSeconds,
        });
      }
    }
  }
}
