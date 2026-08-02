import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { CONTENT_STATUS, SLOT_KIND } from '../constants';
import {
  ExamContentBlueprintEditionEntity,
  ExamContentBlueprintEntity,
  ExamContentEditionBlockEntity,
  ExamContentEditionBlockSlotEntity,
  ExamContentEditionSectionEntity,
  ExamContentLevelEntity,
  ExamContentSelectionRuleEntity,
  ExamContentSelectionRuleTypeEntity,
} from '../entities';
import { ExamContentAccessService } from './exam-content-access.service';
import { ExamContentChangeLogService } from './exam-content-change-log.service';

@Injectable()
export class ExamContentBlueprintsService {
  constructor(
    @InjectRepository(ExamContentBlueprintEntity)
    private readonly blueprints: Repository<ExamContentBlueprintEntity>,
    @InjectRepository(ExamContentBlueprintEditionEntity)
    private readonly editions: Repository<ExamContentBlueprintEditionEntity>,
    @InjectRepository(ExamContentEditionSectionEntity)
    private readonly sections: Repository<ExamContentEditionSectionEntity>,
    @InjectRepository(ExamContentEditionBlockEntity)
    private readonly blocks: Repository<ExamContentEditionBlockEntity>,
    @InjectRepository(ExamContentEditionBlockSlotEntity)
    private readonly slots: Repository<ExamContentEditionBlockSlotEntity>,
    @InjectRepository(ExamContentSelectionRuleEntity)
    private readonly rules: Repository<ExamContentSelectionRuleEntity>,
    @InjectRepository(ExamContentSelectionRuleTypeEntity)
    private readonly ruleTypes: Repository<ExamContentSelectionRuleTypeEntity>,
    @InjectRepository(ExamContentLevelEntity)
    private readonly levels: Repository<ExamContentLevelEntity>,
    private readonly access: ExamContentAccessService,
    private readonly changeLog: ExamContentChangeLogService,
  ) {}

  async listBlueprints(actor: DomainAccessActor, levelId?: string) {
    this.access.assertStaff(actor);
    return this.blueprints.find({
      where: levelId ? { levelId } : {},
      order: { updatedAt: 'DESC' },
      relations: { editions: true, level: true },
    });
  }

  async createBlueprint(actor: DomainAccessActor, input: { levelId: string; name: string }) {
    this.access.assertStaff(actor);
    const level = await this.levels.findOne({ where: { id: input.levelId } });
    if (!level) throw new NotFoundException('Level not found');
    const bp = await this.blueprints.save({
      levelId: level.id,
      name: input.name.trim(),
      status: 'active',
    });
    const edition = await this.editions.save({
      blueprintId: bp.id,
      title: `${bp.name} · v1`,
      revision: 1,
      status: CONTENT_STATUS.Draft,
      supersedesEditionId: null,
      totalDurationSeconds: 0,
      scoringProfileNotes: null,
      publishedAt: null,
      createdByUserId: actor.sub,
    });
    await this.changeLog.record({
      entityType: 'edition',
      entityId: edition.id,
      actorUserId: actor.sub,
      action: 'create',
      summary: 'Created blueprint + draft edition',
    });
    return this.getBlueprint(actor, bp.id);
  }

  async getBlueprint(actor: DomainAccessActor, id: string) {
    this.access.assertStaff(actor);
    const bp = await this.blueprints.findOne({
      where: { id },
      relations: { editions: true, level: true },
    });
    if (!bp) throw new NotFoundException('Blueprint not found');
    return bp;
  }

  async listEditions(actor: DomainAccessActor, blueprintId: string) {
    this.access.assertStaff(actor);
    return this.editions.find({
      where: { blueprintId },
      order: { revision: 'DESC' },
    });
  }

  async getEditionStructure(actor: DomainAccessActor, editionId: string) {
    this.access.assertStaff(actor);
    return this.loadEditionStructure(editionId);
  }

  /** Internal/runtime load without staff ACL (used by variant generator for learners). */
  async loadEditionStructure(editionId: string) {
    const edition = await this.editions.findOne({
      where: { id: editionId },
      relations: {
        sections: {
          blocks: {
            slots: { selectionRule: { typeFilters: true, topicFilters: true } },
          },
        },
        blueprint: true,
      },
    });
    if (!edition) throw new NotFoundException('Edition not found');
    const sections = [...(edition.sections || [])].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const s of sections) {
      s.blocks = [...(s.blocks || [])].sort((a, b) => a.sortOrder - b.sortOrder);
      for (const b of s.blocks) {
        b.slots = [...(b.slots || [])].sort((a, b) => a.sortOrder - b.sortOrder);
      }
    }
    return { edition, sections };
  }

  async replaceStructure(
    actor: DomainAccessActor,
    editionId: string,
    structure: {
      totalDurationSeconds?: number;
      sections: Array<{
        sectionKey: string;
        title: string;
        sortOrder: number;
        durationSeconds?: number | null;
        weightPercent?: number;
        blocks: Array<{
          title: string;
          sortOrder: number;
          durationSeconds?: number | null;
          slots: Array<{
            sortOrder: number;
            slotKind?: string;
            fixedGroupId?: string | null;
            fixedItemId?: string | null;
            rule?: {
              selectCount: number;
              selectGroupCount?: number | null;
              difficultyMin?: number;
              difficultyMax?: number;
              excludeRecentDays?: number;
              denyDuplicateMedia?: boolean;
              allowReuseIfPoolShort?: boolean;
              maxTopicSharePercent?: number | null;
              minMidDifficultySharePercent?: number | null;
              itemTypeCodes?: string[];
            };
          }>;
        }>;
      }>;
    },
  ) {
    this.access.assertStaff(actor);
    const edition = await this.editions.findOne({ where: { id: editionId } });
    if (!edition) throw new NotFoundException('Edition not found');
    if (edition.status === CONTENT_STATUS.Published) {
      throw new BadRequestException('Published edition immutable — clone to draft');
    }

    const existingSections = await this.sections.find({ where: { editionId } });
    for (const s of existingSections) {
      const existingBlocks = await this.blocks.find({ where: { sectionId: s.id } });
      for (const b of existingBlocks) {
        const existingSlots = await this.slots.find({ where: { blockId: b.id } });
        for (const slot of existingSlots) {
          if (slot.selectionRuleId) await this.rules.delete({ id: slot.selectionRuleId });
        }
        await this.slots.delete({ blockId: b.id });
      }
      await this.blocks.delete({ sectionId: s.id });
    }
    await this.sections.delete({ editionId });

    if (structure.totalDurationSeconds != null) {
      edition.totalDurationSeconds = structure.totalDurationSeconds;
      await this.editions.save(edition);
    }

    for (const sec of structure.sections) {
      const section = await this.sections.save({
        editionId,
        sectionKey: sec.sectionKey,
        title: sec.title,
        sortOrder: sec.sortOrder,
        durationSeconds: sec.durationSeconds ?? null,
        weightPercent: String(sec.weightPercent ?? 0),
      });
      for (const blk of sec.blocks || []) {
        const block = await this.blocks.save({
          sectionId: section.id,
          title: blk.title,
          sortOrder: blk.sortOrder,
          durationSeconds: blk.durationSeconds ?? null,
        });
        for (const sl of blk.slots || []) {
          let selectionRuleId: string | null = null;
          const kind = sl.slotKind || SLOT_KIND.Rule;
          if (kind === SLOT_KIND.Rule && sl.rule) {
            const rule = await this.rules.save({
              selectCount: sl.rule.selectCount,
              selectGroupCount: sl.rule.selectGroupCount ?? null,
              selectionMode: 'random',
              difficultyMin: sl.rule.difficultyMin ?? 1,
              difficultyMax: sl.rule.difficultyMax ?? 5,
              subsectionId: null,
              excludeRecentDays: sl.rule.excludeRecentDays ?? 30,
              denyDuplicateMedia: sl.rule.denyDuplicateMedia ?? true,
              allowReuseIfPoolShort: sl.rule.allowReuseIfPoolShort ?? false,
              maxTopicSharePercent:
                sl.rule.maxTopicSharePercent != null
                  ? String(sl.rule.maxTopicSharePercent)
                  : null,
              minMidDifficultySharePercent:
                sl.rule.minMidDifficultySharePercent != null
                  ? String(sl.rule.minMidDifficultySharePercent)
                  : null,
              balanceBy: 'topic',
            });
            selectionRuleId = rule.id;
            if (sl.rule.itemTypeCodes?.length) {
              await this.ruleTypes.save(
                sl.rule.itemTypeCodes.map((code) =>
                  this.ruleTypes.create({ ruleId: rule.id, itemTypeCode: code }),
                ),
              );
            }
          }
          await this.slots.save({
            blockId: block.id,
            sortOrder: sl.sortOrder,
            slotKind: kind,
            selectionRuleId,
            fixedGroupId: sl.fixedGroupId ?? null,
            fixedItemId: sl.fixedItemId ?? null,
          });
        }
      }
    }

    await this.changeLog.record({
      entityType: 'edition',
      entityId: editionId,
      actorUserId: actor.sub,
      action: 'update',
      summary: 'Replaced edition structure',
    });
    return this.getEditionStructure(actor, editionId);
  }

  async setEditionStatus(actor: DomainAccessActor, editionId: string, status: string) {
    this.access.assertStaff(actor);
    const edition = await this.editions.findOne({ where: { id: editionId } });
    if (!edition) throw new NotFoundException('Edition not found');
    if (status === CONTENT_STATUS.Published || status === CONTENT_STATUS.Archived) {
      await this.access.assertCanPublish(actor);
    }
    const before = edition.status;
    edition.status = status;
    if (status === CONTENT_STATUS.Published) edition.publishedAt = new Date();
    await this.editions.save(edition);
    await this.changeLog.record({
      entityType: 'edition',
      entityId: editionId,
      actorUserId: actor.sub,
      action: 'status_change',
      summary: `${before} → ${status}`,
    });
    return edition;
  }

  async cloneEdition(actor: DomainAccessActor, editionId: string) {
    this.access.assertStaff(actor);
    const { edition, sections } = await this.getEditionStructure(actor, editionId);
    const clone = await this.editions.save({
      blueprintId: edition.blueprintId,
      title: `${edition.title} (copy)`,
      revision: edition.revision + 1,
      status: CONTENT_STATUS.Draft,
      supersedesEditionId: edition.id,
      totalDurationSeconds: edition.totalDurationSeconds,
      scoringProfileNotes: edition.scoringProfileNotes,
      publishedAt: null,
      createdByUserId: actor.sub,
    });

    await this.replaceStructure(actor, clone.id, {
      totalDurationSeconds: edition.totalDurationSeconds,
      sections: sections.map((s) => ({
        sectionKey: s.sectionKey,
        title: s.title,
        sortOrder: s.sortOrder,
        durationSeconds: s.durationSeconds,
        weightPercent: Number(s.weightPercent) || 0,
        blocks: (s.blocks || []).map((b) => ({
          title: b.title,
          sortOrder: b.sortOrder,
          durationSeconds: b.durationSeconds,
          slots: (b.slots || []).map((sl) => ({
            sortOrder: sl.sortOrder,
            slotKind: sl.slotKind,
            fixedGroupId: sl.fixedGroupId,
            fixedItemId: sl.fixedItemId,
            rule: sl.selectionRule
              ? {
                  selectCount: sl.selectionRule.selectCount,
                  selectGroupCount: sl.selectionRule.selectGroupCount,
                  difficultyMin: sl.selectionRule.difficultyMin,
                  difficultyMax: sl.selectionRule.difficultyMax,
                  excludeRecentDays: sl.selectionRule.excludeRecentDays,
                  denyDuplicateMedia: sl.selectionRule.denyDuplicateMedia,
                  allowReuseIfPoolShort: sl.selectionRule.allowReuseIfPoolShort,
                  maxTopicSharePercent: sl.selectionRule.maxTopicSharePercent
                    ? Number(sl.selectionRule.maxTopicSharePercent)
                    : null,
                  minMidDifficultySharePercent: sl.selectionRule
                    .minMidDifficultySharePercent
                    ? Number(sl.selectionRule.minMidDifficultySharePercent)
                    : null,
                  itemTypeCodes: (sl.selectionRule.typeFilters || []).map(
                    (t) => t.itemTypeCode,
                  ),
                }
              : undefined,
          })),
        })),
      })),
    });

    await this.changeLog.record({
      entityType: 'edition',
      entityId: clone.id,
      actorUserId: actor.sub,
      action: 'create',
      summary: `Cloned from ${editionId}`,
    });
    return this.getEditionStructure(actor, clone.id);
  }

  editionHistory(actor: DomainAccessActor, editionId: string) {
    this.access.assertStaff(actor);
    return this.changeLog.listForEntity('edition', editionId);
  }
}
