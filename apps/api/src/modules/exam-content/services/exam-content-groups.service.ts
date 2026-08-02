import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { CONTENT_STATUS } from '../constants';
import {
  ExamContentGroupItemEntity,
  ExamContentItemEntity,
  ExamContentItemGroupEntity,
  ExamContentLevelEntity,
  ExamContentProgramVersionEntity,
} from '../entities';
import { ExamContentAccessService } from './exam-content-access.service';
import { ExamContentChangeLogService } from './exam-content-change-log.service';

@Injectable()
export class ExamContentGroupsService {
  constructor(
    @InjectRepository(ExamContentItemGroupEntity)
    private readonly groups: Repository<ExamContentItemGroupEntity>,
    @InjectRepository(ExamContentGroupItemEntity)
    private readonly groupItems: Repository<ExamContentGroupItemEntity>,
    @InjectRepository(ExamContentItemEntity)
    private readonly items: Repository<ExamContentItemEntity>,
    @InjectRepository(ExamContentLevelEntity)
    private readonly levels: Repository<ExamContentLevelEntity>,
    @InjectRepository(ExamContentProgramVersionEntity)
    private readonly versions: Repository<ExamContentProgramVersionEntity>,
    private readonly access: ExamContentAccessService,
    private readonly changeLog: ExamContentChangeLogService,
  ) {}

  async list(
    actor: DomainAccessActor,
    filter: { levelId?: string; versionId?: string; status?: string; search?: string },
  ) {
    this.access.assertStaff(actor);
    const where: Record<string, unknown> = {};
    if (filter.levelId) where.levelId = filter.levelId;
    if (filter.versionId) where.versionId = filter.versionId;
    if (filter.status) where.status = filter.status;
    const rows = await this.groups.find({
      where,
      order: { updatedAt: 'DESC' },
      take: 200,
      relations: { groupItems: true, media: true },
    });
    if (!filter.search) return rows;
    const q = filter.search.toLowerCase();
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.passageText || '').toLowerCase().includes(q),
    );
  }

  async get(actor: DomainAccessActor, id: string) {
    this.access.assertStaff(actor);
    const group = await this.groups.findOne({
      where: { id },
      relations: { groupItems: true, media: true },
    });
    if (!group) throw new NotFoundException('Group not found');
    const itemIds = (group.groupItems || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((gi) => gi.itemId);
    const items = itemIds.length
      ? await this.items.find({ where: { id: In(itemIds) } })
      : [];
    const byId = new Map(items.map((i) => [i.id, i]));
    return {
      group,
      items: itemIds.map((id) => byId.get(id)).filter(Boolean),
    };
  }

  async create(
    actor: DomainAccessActor,
    input: {
      versionId: string;
      levelId: string;
      title: string;
      passageText?: string | null;
      instructions?: string | null;
      sectionId?: string | null;
      topicId?: string | null;
      itemIds?: string[];
    },
  ) {
    this.access.assertStaff(actor);
    const version = await this.versions.findOne({ where: { id: input.versionId } });
    if (!version) throw new NotFoundException('Version not found');
    const level = await this.levels.findOne({ where: { id: input.levelId } });
    if (!level) throw new NotFoundException('Level not found');

    const group = await this.groups.save({
      programId: version.programId,
      versionId: version.id,
      levelId: level.id,
      sectionId: input.sectionId ?? null,
      subsectionId: null,
      topicId: input.topicId ?? null,
      subtopicId: null,
      title: input.title.trim(),
      passageText: input.passageText ?? null,
      instructions: input.instructions ?? null,
      status: CONTENT_STATUS.Draft,
      revision: 1,
      supersedesGroupId: null,
      editionFamilyId: null,
      authorUserId: actor.sub,
      editorUserId: actor.sub,
      reviewedByUserId: null,
      reviewedAt: null,
      publishedAt: null,
    });
    await this.groups.update(group.id, { editionFamilyId: group.id });

    if (input.itemIds?.length) {
      await this.setItems(actor, group.id, input.itemIds);
    }

    await this.changeLog.record({
      entityType: 'group',
      entityId: group.id,
      actorUserId: actor.sub,
      action: 'create',
      summary: 'Created group',
      afterRevision: 1,
    });
    return this.get(actor, group.id);
  }

  async update(
    actor: DomainAccessActor,
    id: string,
    input: {
      title?: string;
      passageText?: string | null;
      instructions?: string | null;
      itemIds?: string[];
    },
  ) {
    this.access.assertStaff(actor);
    const group = await this.groups.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Group not found');
    if (group.status === CONTENT_STATUS.Archived) {
      throw new BadRequestException('Архивную группу нельзя изменить');
    }
    if (input.title != null) group.title = input.title.trim();
    if (input.passageText !== undefined) group.passageText = input.passageText;
    if (input.instructions !== undefined) group.instructions = input.instructions;
    group.editorUserId = actor.sub;
    group.revision += 1;
    await this.groups.save(group);
    if (input.itemIds) await this.setItems(actor, id, input.itemIds);
    await this.changeLog.record({
      entityType: 'group',
      entityId: id,
      actorUserId: actor.sub,
      action: 'update',
      summary: 'Updated group',
      afterRevision: group.revision,
    });
    return this.get(actor, id);
  }

  private async setItems(_actor: DomainAccessActor, groupId: string, itemIds: string[]) {
    await this.groupItems.delete({ groupId });
    if (!itemIds.length) return;
    const found = await this.items.find({ where: { id: In(itemIds) } });
    if (found.length !== itemIds.length) {
      throw new BadRequestException('Некоторые item_ids не найдены');
    }
    await this.groupItems.save(
      itemIds.map((itemId, idx) =>
        this.groupItems.create({ groupId, itemId, sortOrder: idx }),
      ),
    );
    await this.items.update({ id: In(itemIds) }, { groupId });
  }

  async setStatus(actor: DomainAccessActor, id: string, status: string) {
    this.access.assertStaff(actor);
    const group = await this.groups.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Group not found');
    if (status === CONTENT_STATUS.Published || status === CONTENT_STATUS.Archived) {
      await this.access.assertCanPublish(actor);
    }
    const before = group.status;
    group.status = status;
    if (status === CONTENT_STATUS.Published) group.publishedAt = new Date();
    group.editorUserId = actor.sub;
    await this.groups.save(group);
    await this.changeLog.record({
      entityType: 'group',
      entityId: id,
      actorUserId: actor.sub,
      action: 'status_change',
      summary: `${before} → ${status}`,
    });
    return this.get(actor, id);
  }
}
