import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ExamContentTaxonomyService } from '../services/exam-content-taxonomy.service';
import { ExamContentMediaService } from '../services/exam-content-media.service';
import { ExamContentItemsService } from '../services/exam-content-items.service';
import { ExamContentGroupsService } from '../services/exam-content-groups.service';
import { ExamContentBlueprintsService } from '../services/exam-content-blueprints.service';
import { ExamContentVariantGeneratorService } from '../services/exam-content-variant-generator.service';
import { ExamContentOpsService } from '../services/exam-content-ops.service';

class OptionDto {
  @IsString() text!: string;
  @IsBoolean() is_correct!: boolean;
}

class VocabDto {
  @IsString() word!: string;
  @IsOptional() @IsString() pinyin?: string;
  @IsOptional() @IsString() translation?: string;
  @IsOptional() @IsString() explanation?: string;
}

class GrammarDto {
  @IsString() pattern!: string;
  @IsOptional() @IsString() explanation?: string;
}

class CreateItemDto {
  @IsUUID() version_id!: string;
  @IsUUID() level_id!: string;
  @IsString() section_key!: string;
  @IsOptional() @IsUUID() section_id?: string;
  @IsOptional() @IsUUID() subsection_id?: string;
  @IsOptional() @IsUUID() topic_id?: string;
  @IsOptional() @IsUUID() subtopic_id?: string;
  @IsOptional() @IsUUID() group_id?: string;
  @IsOptional() @IsString() item_type_code?: string;
  @IsOptional() @IsString() topic?: string;
  @IsOptional() @IsInt() @Min(1) difficulty?: number;
  @IsOptional() @IsInt() recommended_time_seconds?: number;
  @IsString() stem!: string;
  @IsOptional() @IsString() explanation?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OptionDto) options!: OptionDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VocabDto) vocabulary?: VocabDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => GrammarDto) grammar?: GrammarDto[];
}

class CreateGroupDto {
  @IsUUID() version_id!: string;
  @IsUUID() level_id!: string;
  @IsString() title!: string;
  @IsOptional() @IsString() passage_text?: string;
  @IsOptional() @IsString() instructions?: string;
  @IsOptional() @IsUUID() section_id?: string;
  @IsOptional() @IsUUID() topic_id?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) item_ids?: string[];
}

class RegisterMediaDto {
  @IsString() kind!: string;
  @IsString() storage_key!: string;
  @IsOptional() @IsString() mime?: string;
  @IsOptional() @IsString() size_bytes?: string;
  @IsOptional() @IsInt() duration_ms?: number;
  @IsOptional() @IsString() checksum?: string;
  @IsOptional() @IsString() title?: string;
}

class CreateBlueprintDto {
  @IsUUID() level_id!: string;
  @IsString() name!: string;
}

class GenerateDto {
  @IsOptional() @IsUUID() blueprint_edition_id?: string;
  @IsOptional() @IsUUID() level_id?: string;
  @IsOptional() @IsString() section_key?: string;
  @IsOptional() @IsInt() question_count?: number;
  @IsOptional() @IsUUID() learner_user_id?: string;
  @IsOptional() @IsInt() seed?: number;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) engine_content_ids?: string[];
}

class BulkDto {
  @IsString() action!: string;
  @IsArray() @IsUUID('4', { each: true }) item_ids!: string[];
  @IsOptional() patch?: {
    level_id?: string;
    version_id?: string;
    topic_id?: string | null;
    topic?: string | null;
  };
}

class ImportDto {
  @IsString() format!: string;
  @IsArray() rows!: Array<Record<string, unknown>>;
}

class ExportDto {
  @IsString() format!: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) item_ids?: string[];
  @IsOptional() @IsUUID() level_id?: string;
}

class RuleDto {
  @IsInt() @Min(1) select_count!: number;
  @IsOptional() @IsInt() select_group_count?: number;
  @IsOptional() @IsInt() difficulty_min?: number;
  @IsOptional() @IsInt() difficulty_max?: number;
  @IsOptional() @IsInt() exclude_recent_days?: number;
  @IsOptional() @IsBoolean() deny_duplicate_media?: boolean;
  @IsOptional() @IsBoolean() allow_reuse_if_pool_short?: boolean;
  @IsOptional() @IsNumber() max_topic_share_percent?: number;
  @IsOptional() @IsNumber() min_mid_difficulty_share_percent?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) item_type_codes?: string[];
}

class SlotDto {
  @IsInt() sort_order!: number;
  @IsOptional() @IsString() slot_kind?: string;
  @IsOptional() @IsUUID() fixed_group_id?: string;
  @IsOptional() @IsUUID() fixed_item_id?: string;
  @IsOptional() @ValidateNested() @Type(() => RuleDto) rule?: RuleDto;
}

class BlockDto {
  @IsString() title!: string;
  @IsInt() sort_order!: number;
  @IsOptional() @IsInt() duration_seconds?: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SlotDto) slots!: SlotDto[];
}

class SectionDto {
  @IsString() section_key!: string;
  @IsString() title!: string;
  @IsInt() sort_order!: number;
  @IsOptional() @IsInt() duration_seconds?: number;
  @IsOptional() @IsNumber() weight_percent?: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => BlockDto) blocks!: BlockDto[];
}

class StructureDto {
  @IsOptional() @IsInt() total_duration_seconds?: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SectionDto) sections!: SectionDto[];
}

/** Exam Content Studio — Longhua school staff only (not tutors). */
@Controller('exam-content')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'teacher')
export class ExamContentController {
  constructor(
    private readonly taxonomy: ExamContentTaxonomyService,
    private readonly media: ExamContentMediaService,
    private readonly items: ExamContentItemsService,
    private readonly groups: ExamContentGroupsService,
    private readonly blueprints: ExamContentBlueprintsService,
    private readonly generator: ExamContentVariantGeneratorService,
    private readonly ops: ExamContentOpsService,
  ) {}

  private actor(req: { user: DomainAccessActor }): DomainAccessActor {
    return req.user;
  }

  // Taxonomy
  @Get('taxonomy/programs')
  listPrograms() {
    return this.taxonomy.listPrograms();
  }

  @Get('taxonomy/versions')
  listVersions(@Query('program') program?: string) {
    return this.taxonomy.listVersions(program);
  }

  @Get('taxonomy/levels')
  listLevels(@Query('version') version: string) {
    return this.taxonomy.listLevels(version);
  }

  @Get('taxonomy/sections')
  listSections(@Query('levelId') levelId: string) {
    return this.taxonomy.listSections(levelId);
  }

  @Get('taxonomy/topics')
  listTopics(@Query('versionId') versionId: string) {
    return this.taxonomy.listTopics(versionId);
  }

  @Get('item-types')
  listItemTypes() {
    return this.taxonomy.listItemTypes();
  }

  @Post('item-types')
  createItemType(@Req() req: { user: DomainAccessActor }, @Body() body: Record<string, string>) {
    return this.taxonomy.createItemType(this.actor(req), {
      code: body.code,
      title: body.title,
      engineAdapter: body.engine_adapter || body.engineAdapter,
      engineQuestionType: body.engine_question_type,
      answerShape: body.answer_shape || 'choice',
      rendererKey: body.renderer_key || body.code,
      editorKey: body.editor_key,
    });
  }

  // Media
  @Get('media')
  listMedia(@Req() req: { user: DomainAccessActor }, @Query('kind') kind?: string) {
    return this.media.list(this.actor(req), kind);
  }

  @Post('media')
  registerMedia(@Req() req: { user: DomainAccessActor }, @Body() body: RegisterMediaDto) {
    return this.media.register(this.actor(req), {
      kind: body.kind,
      storageKey: body.storage_key,
      mime: body.mime,
      sizeBytes: body.size_bytes,
      durationMs: body.duration_ms,
      checksum: body.checksum,
      title: body.title,
    });
  }

  @Delete('media/:id')
  archiveMedia(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.media.softArchive(this.actor(req), id);
  }

  @Post('media/:id/link-item')
  linkItemMedia(
    @Req() req: { user: DomainAccessActor },
    @Param('id') id: string,
    @Body() body: { item_id: string; role?: string; sort_order?: number },
  ) {
    return this.media.linkItem(
      this.actor(req),
      body.item_id,
      id,
      body.role,
      body.sort_order,
    );
  }

  @Post('media/:id/link-group')
  linkGroupMedia(
    @Req() req: { user: DomainAccessActor },
    @Param('id') id: string,
    @Body() body: { group_id: string; role?: string; sort_order?: number; cascade_items?: boolean },
  ) {
    return this.media.linkGroup(
      this.actor(req),
      body.group_id,
      id,
      body.role,
      body.sort_order,
      body.cascade_items !== false,
    );
  }

  // Items
  @Get('items')
  searchItems(
    @Req() req: { user: DomainAccessActor },
    @Query() q: Record<string, string>,
  ) {
    return this.items.search(this.actor(req), {
      programId: q.programId,
      versionId: q.versionId,
      levelId: q.levelId,
      sectionKey: q.sectionKey,
      subsectionId: q.subsectionId,
      topicId: q.topicId,
      subtopicId: q.subtopicId,
      itemTypeCode: q.itemTypeCode,
      difficultyMin: q.difficultyMin ? Number(q.difficultyMin) : undefined,
      difficultyMax: q.difficultyMax ? Number(q.difficultyMax) : undefined,
      authorUserId: q.authorUserId,
      editorUserId: q.editorUserId,
      status: q.status,
      hasImage: q.hasImage === 'true',
      hasAudio: q.hasAudio === 'true',
      hasVideo: q.hasVideo === 'true',
      hasPdf: q.hasPdf === 'true',
      vocabularyWord: q.vocabularyWord,
      grammarPattern: q.grammarPattern,
      search: q.search,
    });
  }

  @Post('items/preview')
  previewItem(@Req() req: { user: DomainAccessActor }, @Body() body: CreateItemDto) {
    return this.items.preview(this.actor(req), {
      versionId: body.version_id,
      levelId: body.level_id,
      sectionKey: body.section_key,
      itemTypeCode: body.item_type_code,
      topic: body.topic,
      difficulty: body.difficulty,
      recommendedTimeSeconds: body.recommended_time_seconds,
      stem: body.stem,
      explanation: body.explanation,
      options: body.options.map((o) => ({ text: o.text, isCorrect: o.is_correct })),
      vocabulary: body.vocabulary,
      grammar: body.grammar,
    });
  }

  @Post('items')
  createItem(@Req() req: { user: DomainAccessActor }, @Body() body: CreateItemDto) {
    return this.items.create(this.actor(req), {
      versionId: body.version_id,
      levelId: body.level_id,
      sectionKey: body.section_key,
      sectionId: body.section_id,
      subsectionId: body.subsection_id,
      topicId: body.topic_id,
      subtopicId: body.subtopic_id,
      groupId: body.group_id,
      itemTypeCode: body.item_type_code,
      topic: body.topic,
      difficulty: body.difficulty,
      recommendedTimeSeconds: body.recommended_time_seconds,
      stem: body.stem,
      explanation: body.explanation,
      options: body.options.map((o) => ({ text: o.text, isCorrect: o.is_correct })),
      vocabulary: body.vocabulary?.map((v) => ({
        word: v.word,
        pinyin: v.pinyin,
        translation: v.translation,
        explanation: v.explanation,
      })),
      grammar: body.grammar?.map((g) => ({
        pattern: g.pattern,
        explanation: g.explanation,
      })),
    });
  }

  @Get('items/:id')
  getItem(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.items.get(this.actor(req), id);
  }

  @Patch('items/:id')
  updateItem(
    @Req() req: { user: DomainAccessActor },
    @Param('id') id: string,
    @Body() body: Partial<CreateItemDto>,
  ) {
    return this.items.update(this.actor(req), id, {
      versionId: body.version_id,
      levelId: body.level_id,
      sectionKey: body.section_key,
      sectionId: body.section_id,
      subsectionId: body.subsection_id,
      topicId: body.topic_id,
      subtopicId: body.subtopic_id,
      groupId: body.group_id,
      itemTypeCode: body.item_type_code,
      topic: body.topic,
      difficulty: body.difficulty,
      recommendedTimeSeconds: body.recommended_time_seconds,
      stem: body.stem,
      explanation: body.explanation,
      options: body.options?.map((o) => ({ text: o.text, isCorrect: o.is_correct })),
      vocabulary: body.vocabulary?.map((v) => ({
        word: v.word,
        pinyin: v.pinyin,
        translation: v.translation,
        explanation: v.explanation,
      })),
      grammar: body.grammar?.map((g) => ({
        pattern: g.pattern,
        explanation: g.explanation,
      })),
    });
  }

  /** @deprecated Review workflow removed — publishes immediately. */
  @Post('items/:id/submit-review')
  submitReview(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.items.setStatus(this.actor(req), id, 'published');
  }

  @Post('items/:id/publish')
  publishItem(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.items.setStatus(this.actor(req), id, 'published');
  }

  @Post('items/:id/archive')
  archiveItem(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.items.setStatus(this.actor(req), id, 'archived');
  }

  @Get('items/:id/history')
  itemHistory(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.items.history(this.actor(req), id);
  }

  @Post('items/:id/rollback')
  rollbackItem(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.items.rollback(this.actor(req), id);
  }

  @Get('items/:id/stats')
  itemStats(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.items.getStats(this.actor(req), id);
  }

  // Groups
  @Get('groups')
  listGroups(
    @Req() req: { user: DomainAccessActor },
    @Query('levelId') levelId?: string,
    @Query('versionId') versionId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.groups.list(this.actor(req), { levelId, versionId, status, search });
  }

  @Get('groups/:id')
  getGroup(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.groups.get(this.actor(req), id);
  }

  @Post('groups')
  createGroup(@Req() req: { user: DomainAccessActor }, @Body() body: CreateGroupDto) {
    return this.groups.create(this.actor(req), {
      versionId: body.version_id,
      levelId: body.level_id,
      title: body.title,
      passageText: body.passage_text,
      instructions: body.instructions,
      sectionId: body.section_id,
      topicId: body.topic_id,
      itemIds: body.item_ids,
    });
  }

  @Patch('groups/:id')
  updateGroup(
    @Req() req: { user: DomainAccessActor },
    @Param('id') id: string,
    @Body() body: Partial<CreateGroupDto>,
  ) {
    return this.groups.update(this.actor(req), id, {
      title: body.title,
      passageText: body.passage_text,
      instructions: body.instructions,
      itemIds: body.item_ids,
    });
  }

  /** @deprecated Review workflow removed — publishes immediately. */
  @Post('groups/:id/submit-review')
  groupReview(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.groups.setStatus(this.actor(req), id, 'published');
  }

  @Post('groups/:id/publish')
  groupPublish(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.groups.setStatus(this.actor(req), id, 'published');
  }

  @Post('groups/:id/archive')
  groupArchive(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.groups.setStatus(this.actor(req), id, 'archived');
  }

  // Blueprints
  @Get('blueprints')
  listBlueprints(
    @Req() req: { user: DomainAccessActor },
    @Query('levelId') levelId?: string,
  ) {
    return this.blueprints.listBlueprints(this.actor(req), levelId);
  }

  @Post('blueprints')
  createBlueprint(@Req() req: { user: DomainAccessActor }, @Body() body: CreateBlueprintDto) {
    return this.blueprints.createBlueprint(this.actor(req), {
      levelId: body.level_id,
      name: body.name,
    });
  }

  @Get('blueprints/:id')
  getBlueprint(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.blueprints.getBlueprint(this.actor(req), id);
  }

  @Get('blueprints/:id/editions')
  listEditions(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.blueprints.listEditions(this.actor(req), id);
  }

  @Get('editions/:id/structure')
  editionStructure(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.blueprints.getEditionStructure(this.actor(req), id);
  }

  @Patch('editions/:id/structure')
  replaceStructure(
    @Req() req: { user: DomainAccessActor },
    @Param('id') id: string,
    @Body() body: StructureDto,
  ) {
    return this.blueprints.replaceStructure(this.actor(req), id, {
      totalDurationSeconds: body.total_duration_seconds,
      sections: body.sections.map((s) => ({
        sectionKey: s.section_key,
        title: s.title,
        sortOrder: s.sort_order,
        durationSeconds: s.duration_seconds,
        weightPercent: s.weight_percent,
        blocks: s.blocks.map((b) => ({
          title: b.title,
          sortOrder: b.sort_order,
          durationSeconds: b.duration_seconds,
          slots: b.slots.map((sl) => ({
            sortOrder: sl.sort_order,
            slotKind: sl.slot_kind,
            fixedGroupId: sl.fixed_group_id,
            fixedItemId: sl.fixed_item_id,
            rule: sl.rule
              ? {
                  selectCount: sl.rule.select_count,
                  selectGroupCount: sl.rule.select_group_count,
                  difficultyMin: sl.rule.difficulty_min,
                  difficultyMax: sl.rule.difficulty_max,
                  excludeRecentDays: sl.rule.exclude_recent_days,
                  denyDuplicateMedia: sl.rule.deny_duplicate_media,
                  allowReuseIfPoolShort: sl.rule.allow_reuse_if_pool_short,
                  maxTopicSharePercent: sl.rule.max_topic_share_percent,
                  minMidDifficultySharePercent: sl.rule.min_mid_difficulty_share_percent,
                  itemTypeCodes: sl.rule.item_type_codes,
                }
              : undefined,
          })),
        })),
      })),
    });
  }

  /** @deprecated Review workflow removed — publishes immediately. */
  @Post('editions/:id/submit-review')
  editionReview(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.blueprints.setEditionStatus(this.actor(req), id, 'published');
  }

  @Post('editions/:id/publish')
  editionPublish(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.blueprints.setEditionStatus(this.actor(req), id, 'published');
  }

  @Post('editions/:id/archive')
  editionArchive(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.blueprints.setEditionStatus(this.actor(req), id, 'archived');
  }

  @Post('editions/:id/clone')
  editionClone(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.blueprints.cloneEdition(this.actor(req), id);
  }

  @Get('editions/:id/history')
  editionHistory(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.blueprints.editionHistory(this.actor(req), id);
  }

  // Generate
  @Post('generate')
  generate(@Req() req: { user: DomainAccessActor }, @Body() body: GenerateDto) {
    return this.generator.generate(this.actor(req), {
      blueprintEditionId: body.blueprint_edition_id,
      levelId: body.level_id,
      sectionKey: body.section_key,
      questionCount: body.question_count,
      learnerUserId: body.learner_user_id,
      seed: body.seed,
      engineContentIds: body.engine_content_ids,
    });
  }

  // Ops
  @Post('import')
  importRows(@Req() req: { user: DomainAccessActor }, @Body() body: ImportDto) {
    return this.ops.startImport(this.actor(req), {
      format: body.format,
      rows: body.rows as never,
    });
  }

  @Get('import/:id')
  getImport(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.ops.getImport(this.actor(req), id);
  }

  @Post('export')
  exportRows(@Req() req: { user: DomainAccessActor }, @Body() body: ExportDto) {
    return this.ops.startExport(this.actor(req), {
      format: body.format,
      itemIds: body.item_ids,
      levelId: body.level_id,
    });
  }

  @Get('export/:id')
  getExport(@Req() req: { user: DomainAccessActor }, @Param('id') id: string) {
    return this.ops.getExport(this.actor(req), id);
  }

  @Post('bulk')
  bulk(@Req() req: { user: DomainAccessActor }, @Body() body: BulkDto) {
    return this.ops.bulk(this.actor(req), {
      action: body.action,
      itemIds: body.item_ids,
      patch: body.patch
        ? {
            levelId: body.patch.level_id,
            versionId: body.patch.version_id,
            topicId: body.patch.topic_id,
            topic: body.patch.topic,
          }
        : undefined,
    });
  }

  @Post('stats/recompute')
  recomputeStats(@Req() req: { user: DomainAccessActor }) {
    return this.ops.recomputeStats(this.actor(req));
  }
}
