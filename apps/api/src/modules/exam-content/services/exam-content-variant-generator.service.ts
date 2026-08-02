import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { CONTENT_STATUS, SLOT_KIND } from '../constants';
import {
  ExamContentBlueprintEditionEntity,
  ExamContentEditionBlockSlotEntity,
  ExamContentGroupItemEntity,
  ExamContentItemEntity,
  ExamContentItemGroupEntity,
  ExamContentItemMediaEntity,
  ExamContentItemUsageEntity,
  ExamContentSelectionRuleEntity,
} from '../entities';
import { ExamContentBlueprintsService } from './exam-content-blueprints.service';

export type PoolPartPlan = {
  partKind: 'test' | 'listening' | 'reading';
  title: string;
  selectCount: number;
  pool: Array<{
    questionId: string | null;
    readingTaskId: string | null;
    listeningTaskId: string | null;
    itemId: string;
    groupId: string | null;
  }>;
};

export type GenerateResult = {
  blueprintId: string | null;
  blueprintEditionId: string | null;
  totalDurationSeconds: number;
  parts: PoolPartPlan[];
  selectedItemIds: string[];
};

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

@Injectable()
export class ExamContentVariantGeneratorService {
  constructor(
    @InjectRepository(ExamContentBlueprintEditionEntity)
    private readonly editions: Repository<ExamContentBlueprintEditionEntity>,
    @InjectRepository(ExamContentItemEntity)
    private readonly items: Repository<ExamContentItemEntity>,
    @InjectRepository(ExamContentItemGroupEntity)
    private readonly groups: Repository<ExamContentItemGroupEntity>,
    @InjectRepository(ExamContentGroupItemEntity)
    private readonly groupItems: Repository<ExamContentGroupItemEntity>,
    @InjectRepository(ExamContentItemUsageEntity)
    private readonly usage: Repository<ExamContentItemUsageEntity>,
    @InjectRepository(ExamContentItemMediaEntity)
    private readonly itemMedia: Repository<ExamContentItemMediaEntity>,
    private readonly blueprints: ExamContentBlueprintsService,
  ) {}

  async generate(
    actor: DomainAccessActor,
    input: {
      blueprintEditionId?: string | null;
      levelId?: string;
      sectionKey?: string | null;
      questionCount?: number | null;
      learnerUserId?: string;
      engineContentIds?: string[];
      seed?: number;
      sessionId?: string | null;
    },
  ): Promise<GenerateResult> {
    const learnerUserId = input.learnerUserId || actor.sub;
    const rand = mulberry32(input.seed ?? Date.now() % 1_000_000_000);

    if (input.engineContentIds?.length) {
      const items = await this.items.find({
        where: {
          engineContentId: In(input.engineContentIds),
          status: CONTENT_STATUS.Published,
        },
      });
      return this.packItems(items, null, null, 0, 'Практика');
    }

    if (input.blueprintEditionId) {
      return this.generateFromEdition(
        actor,
        input.blueprintEditionId,
        learnerUserId,
        rand,
        input.sessionId,
      );
    }

    if (!input.levelId) {
      throw new BadRequestException('level_id или blueprint_edition_id обязателен');
    }

    const where: Record<string, unknown> = {
      levelId: input.levelId,
      status: CONTENT_STATUS.Published,
    };
    if (input.sectionKey) where.sectionKey = input.sectionKey;
    let items = await this.items.find({ where });
    items = this.shuffle(items, rand);
    const count =
      input.questionCount && input.questionCount > 0
        ? input.questionCount
        : items.length;
    items = items.slice(0, Math.max(0, count));
    if (!items.length) {
      throw new BadRequestException(
        'Банк ECP пуст для выбранного уровня/раздела. Добавьте задания в Exam Content Studio.',
      );
    }
    return this.packItems(items, null, null, 0, input.sectionKey || 'Практика');
  }

  private async generateFromEdition(
    actor: DomainAccessActor,
    editionId: string,
    learnerUserId: string,
    rand: () => number,
    sessionId?: string | null,
  ): Promise<GenerateResult> {
    const edition = await this.editions.findOne({
      where: { id: editionId },
      relations: { blueprint: true },
    });
    if (!edition) throw new NotFoundException('Edition not found');
    if (edition.status !== CONTENT_STATUS.Published && !this.isStaffPreview(actor)) {
      throw new BadRequestException('Только published edition доступна ученикам');
    }

    const { sections } = await this.blueprints.loadEditionStructure(editionId);
    const levelId = edition.blueprint?.levelId;
    if (!levelId) throw new BadRequestException('Edition blueprint missing level');

    const pickedAssetIds = new Set<string>();
    const selectedItemIds: string[] = [];
    const parts: PoolPartPlan[] = [];

    for (const section of sections) {
      const sectionItems: ExamContentItemEntity[] = [];
      for (const block of section.blocks || []) {
        for (const slot of block.slots || []) {
          const picked = await this.resolveSlot(
            slot,
            levelId,
            section.sectionKey,
            learnerUserId,
            rand,
            pickedAssetIds,
          );
          sectionItems.push(...picked);
          selectedItemIds.push(...picked.map((i) => i.id));
        }
      }
      if (sectionItems.length) {
        parts.push(this.toPart(sectionItems, section.title, section.sectionKey));
      }
    }

    if (!parts.length) {
      throw new BadRequestException(
        'Не удалось собрать вариант: недостаточно published групп/заданий под правила edition.',
      );
    }

    if (sessionId) {
      await this.usage.save(
        selectedItemIds.map((itemId) =>
          this.usage.create({
            userId: learnerUserId,
            itemId,
            groupId: null,
            sessionId,
            assessmentAttemptId: null,
          }),
        ),
      );
    }

    return {
      blueprintId: edition.blueprintId,
      blueprintEditionId: edition.id,
      totalDurationSeconds: edition.totalDurationSeconds,
      parts,
      selectedItemIds,
    };
  }

  private isStaffPreview(actor: DomainAccessActor): boolean {
    const role = String(actor.role || '').toLowerCase();
    return role === 'admin' || role === 'teacher' || role === 'tutor';
  }

  private async resolveSlot(
    slot: ExamContentEditionBlockSlotEntity,
    levelId: string,
    sectionKey: string,
    learnerUserId: string,
    rand: () => number,
    pickedAssetIds: Set<string>,
  ): Promise<ExamContentItemEntity[]> {
    if (slot.slotKind === SLOT_KIND.FixedItem && slot.fixedItemId) {
      const item = await this.items.findOne({
        where: { id: slot.fixedItemId, status: CONTENT_STATUS.Published },
      });
      return item ? [item] : [];
    }
    if (slot.slotKind === SLOT_KIND.FixedGroup && slot.fixedGroupId) {
      return this.itemsForGroup(slot.fixedGroupId);
    }

    const rule = slot.selectionRule;
    if (!rule) {
      throw new BadRequestException(`Slot ${slot.id} has no selection rule`);
    }

    const typeCodes = (rule.typeFilters || []).map((t) => t.itemTypeCode);
    let candidates = await this.items.find({
      where: {
        levelId,
        sectionKey,
        status: CONTENT_STATUS.Published,
      },
      relations: { media: true },
    });

    candidates = candidates.filter(
      (i) =>
        i.difficulty >= rule.difficultyMin &&
        i.difficulty <= rule.difficultyMax &&
        (!typeCodes.length || typeCodes.includes(i.itemTypeCode)),
    );

    if (rule.excludeRecentDays > 0) {
      const since = new Date();
      since.setDate(since.getDate() - rule.excludeRecentDays);
      const recent = await this.usage.find({
        where: { userId: learnerUserId, usedAt: LessThan(new Date()) },
        take: 5000,
      });
      const recentIds = new Set(
        recent.filter((u) => u.usedAt >= since).map((u) => u.itemId),
      );
      const filtered = candidates.filter((c) => !recentIds.has(c.id));
      if (filtered.length >= rule.selectCount || !rule.allowReuseIfPoolShort) {
        candidates = filtered.length ? filtered : candidates;
        if (filtered.length < rule.selectCount && !rule.allowReuseIfPoolShort) {
          // keep filtered; may fail below
          candidates = filtered;
        }
      }
    }

    if (rule.denyDuplicateMedia && pickedAssetIds.size) {
      const withoutDupMedia = candidates.filter((c) => {
        const assets = (c.media || []).map((m) => m.assetId);
        return !assets.some((a) => pickedAssetIds.has(a));
      });
      if (withoutDupMedia.length >= rule.selectCount || !rule.allowReuseIfPoolShort) {
        candidates = withoutDupMedia;
      }
    }

    // Prefer whole groups when selectGroupCount set
    const targetGroups = rule.selectGroupCount ?? null;
    if (targetGroups != null && targetGroups > 0) {
      const groupIds = [
        ...new Set(candidates.map((c) => c.groupId).filter(Boolean) as string[]),
      ];
      const publishedGroups = groupIds.length
        ? await this.groups.find({
            where: { id: In(groupIds), status: CONTENT_STATUS.Published },
          })
        : [];
      let groupPool = this.shuffle(publishedGroups, rand);
      groupPool = this.applyTopicBalance(
        groupPool.map((g) => ({
          id: g.id,
          topicKey: g.topicId || 'none',
          difficulty: 3,
        })),
        rule,
        targetGroups,
        rand,
      )
        .map((x) => publishedGroups.find((g) => g.id === x.id)!)
        .filter(Boolean);

      const out: ExamContentItemEntity[] = [];
      for (const g of groupPool.slice(0, targetGroups)) {
        const gis = await this.itemsForGroup(g.id);
        out.push(...gis);
        await this.markAssets(gis, pickedAssetIds);
      }
      if (out.length === 0 && !rule.allowReuseIfPoolShort) {
        throw new BadRequestException(
          `Недостаточно групп для section ${sectionKey} (нужно ${targetGroups})`,
        );
      }
      return out;
    }

    // Standalone / group-of-one sampling by select_count
    // Collapse grouped items: pick by group or item
    const units = this.toSelectionUnits(candidates);
    let balanced = this.applyTopicBalance(
      units.map((u) => ({
        id: u.key,
        topicKey: u.topicKey,
        difficulty: u.difficulty,
      })),
      rule,
      rule.selectCount,
      rand,
    );

    if (balanced.length < rule.selectCount && !rule.allowReuseIfPoolShort) {
      throw new BadRequestException(
        `Пул слишком мал для section ${sectionKey}: нужно ${rule.selectCount}, есть ${balanced.length}`,
      );
    }

    if (balanced.length < rule.selectCount && rule.allowReuseIfPoolShort) {
      const shuffled = this.shuffle(units, rand);
      while (balanced.length < rule.selectCount && shuffled.length) {
        const next = shuffled[balanced.length % shuffled.length];
        if (!balanced.find((b) => b.id === next.key)) {
          balanced.push({
            id: next.key,
            topicKey: next.topicKey,
            difficulty: next.difficulty,
          });
        } else {
          balanced.push({
            id: next.key,
            topicKey: next.topicKey,
            difficulty: next.difficulty,
          });
          break;
        }
      }
    }

    const out: ExamContentItemEntity[] = [];
    const unitMap = new Map(units.map((u) => [u.key, u]));
    for (const b of balanced.slice(0, rule.selectCount)) {
      const unit = unitMap.get(b.id);
      if (!unit) continue;
      out.push(...unit.items);
      await this.markAssets(unit.items, pickedAssetIds);
    }
    return out;
  }

  private toSelectionUnits(items: ExamContentItemEntity[]) {
    const byGroup = new Map<string, ExamContentItemEntity[]>();
    const standalone: ExamContentItemEntity[] = [];
    for (const item of items) {
      if (item.groupId) {
        const arr = byGroup.get(item.groupId) || [];
        arr.push(item);
        byGroup.set(item.groupId, arr);
      } else {
        standalone.push(item);
      }
    }
    const units: Array<{
      key: string;
      topicKey: string;
      difficulty: number;
      items: ExamContentItemEntity[];
    }> = [];
    for (const [gid, gis] of byGroup) {
      units.push({
        key: `g:${gid}`,
        topicKey: gis[0].topicId || gis[0].topic || 'none',
        difficulty: Math.round(
          gis.reduce((s, i) => s + i.difficulty, 0) / Math.max(1, gis.length),
        ),
        items: gis,
      });
    }
    for (const item of standalone) {
      units.push({
        key: `i:${item.id}`,
        topicKey: item.topicId || item.topic || 'none',
        difficulty: item.difficulty,
        items: [item],
      });
    }
    return units;
  }

  private applyTopicBalance(
    units: Array<{ id: string; topicKey: string; difficulty: number }>,
    rule: ExamContentSelectionRuleEntity,
    count: number,
    rand: () => number,
  ) {
    const shuffled = this.shuffle(units, rand);
    const maxShare = rule.maxTopicSharePercent
      ? Number(rule.maxTopicSharePercent) / 100
      : null;
    const minMid = rule.minMidDifficultySharePercent
      ? Number(rule.minMidDifficultySharePercent) / 100
      : null;

    const picked: typeof units = [];
    const topicCounts = new Map<string, number>();

    for (const u of shuffled) {
      if (picked.length >= count) break;
      if (maxShare != null && picked.length > 0) {
        const nextCount = (topicCounts.get(u.topicKey) || 0) + 1;
        if (nextCount / count > maxShare + 1e-9) continue;
      }
      picked.push(u);
      topicCounts.set(u.topicKey, (topicCounts.get(u.topicKey) || 0) + 1);
    }

    // Fill remaining if constraints blocked
    if (picked.length < count) {
      for (const u of shuffled) {
        if (picked.length >= count) break;
        if (picked.find((p) => p.id === u.id)) continue;
        picked.push(u);
      }
    }

    if (minMid != null && picked.length) {
      const mid = picked.filter((p) => p.difficulty >= 2 && p.difficulty <= 4);
      if (mid.length / picked.length < minMid) {
        // try swap in mid-difficulty from remaining
        const midPool = shuffled.filter(
          (u) =>
            u.difficulty >= 2 &&
            u.difficulty <= 4 &&
            !picked.find((p) => p.id === u.id),
        );
        for (const m of midPool) {
          if (mid.length / picked.length >= minMid) break;
          const replaceIdx = picked.findIndex(
            (p) => p.difficulty < 2 || p.difficulty > 4,
          );
          if (replaceIdx < 0) break;
          picked[replaceIdx] = m;
        }
      }
    }

    return picked.slice(0, count);
  }

  private async itemsForGroup(groupId: string) {
    const links = await this.groupItems.find({
      where: { groupId },
      order: { sortOrder: 'ASC' },
    });
    if (!links.length) return [];
    const items = await this.items.find({
      where: {
        id: In(links.map((l) => l.itemId)),
        status: CONTENT_STATUS.Published,
      },
      relations: { media: true },
    });
    const map = new Map(items.map((i) => [i.id, i]));
    return links.map((l) => map.get(l.itemId)).filter(Boolean) as ExamContentItemEntity[];
  }

  private async markAssets(items: ExamContentItemEntity[], picked: Set<string>) {
    const ids = items.map((i) => i.id);
    if (!ids.length) return;
    const media = await this.itemMedia.find({ where: { itemId: In(ids) } });
    for (const m of media) picked.add(m.assetId);
    for (const item of items) {
      for (const m of item.media || []) picked.add(m.assetId);
    }
  }

  private shuffle<T>(arr: T[], rand: () => number): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  private packItems(
    items: ExamContentItemEntity[],
    blueprintId: string | null,
    blueprintEditionId: string | null,
    totalDurationSeconds: number,
    title: string,
  ): GenerateResult {
    return {
      blueprintId,
      blueprintEditionId,
      totalDurationSeconds,
      parts: items.length ? [this.toPart(items, title, items[0]?.sectionKey)] : [],
      selectedItemIds: items.map((i) => i.id),
    };
  }

  private toPart(
    items: ExamContentItemEntity[],
    title: string,
    sectionKey?: string,
  ): PoolPartPlan {
    const listening = items.filter((i) => i.contentKind === 'listening_task');
    const reading = items.filter((i) => i.contentKind === 'reading_task');
    const questions = items.filter((i) => i.contentKind === 'question');

    const mapPool = (list: ExamContentItemEntity[]) =>
      list.map((i) => ({
        questionId: i.contentKind === 'question' ? i.engineContentId : null,
        readingTaskId: i.contentKind === 'reading_task' ? i.engineContentId : null,
        listeningTaskId: i.contentKind === 'listening_task' ? i.engineContentId : null,
        itemId: i.id,
        groupId: i.groupId,
      }));

    if (listening.length && !reading.length && !questions.length) {
      return {
        partKind: 'listening',
        title,
        selectCount: listening.length,
        pool: mapPool(listening),
      };
    }
    if (reading.length && !listening.length && !questions.length) {
      return {
        partKind: 'reading',
        title,
        selectCount: reading.length,
        pool: mapPool(reading),
      };
    }
    const use = questions.length ? questions : items;
    return {
      partKind: 'test',
      title: title || sectionKey || 'Part',
      selectCount: use.length,
      pool: mapPool(use),
    };
  }
}
