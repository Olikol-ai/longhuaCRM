import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  ExamContentGroupMediaEntity,
  ExamContentItemMediaEntity,
  ExamContentMediaAssetEntity,
  ExamContentGroupItemEntity,
} from '../entities';
import { ExamContentAccessService } from './exam-content-access.service';
import { ExamContentChangeLogService } from './exam-content-change-log.service';

@Injectable()
export class ExamContentMediaService {
  constructor(
    @InjectRepository(ExamContentMediaAssetEntity)
    private readonly assets: Repository<ExamContentMediaAssetEntity>,
    @InjectRepository(ExamContentItemMediaEntity)
    private readonly itemMedia: Repository<ExamContentItemMediaEntity>,
    @InjectRepository(ExamContentGroupMediaEntity)
    private readonly groupMedia: Repository<ExamContentGroupMediaEntity>,
    @InjectRepository(ExamContentGroupItemEntity)
    private readonly groupItems: Repository<ExamContentGroupItemEntity>,
    private readonly access: ExamContentAccessService,
    private readonly changeLog: ExamContentChangeLogService,
  ) {}

  async list(actor: DomainAccessActor, kind?: string) {
    this.access.assertStaff(actor);
    const where: Record<string, unknown> = { status: 'active' };
    if (kind) where.kind = kind;
    return this.assets.find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  async register(
    actor: DomainAccessActor,
    input: {
      kind: string;
      storageKey: string;
      mime?: string | null;
      sizeBytes?: string | null;
      durationMs?: number | null;
      checksum?: string | null;
      title?: string | null;
    },
  ) {
    this.access.assertStaff(actor);
    if (!input.storageKey?.trim()) {
      throw new BadRequestException('storage_key обязателен');
    }
    const asset = await this.assets.save({
      kind: input.kind,
      storageKey: input.storageKey.trim(),
      mime: input.mime ?? null,
      sizeBytes: input.sizeBytes ?? null,
      durationMs: input.durationMs ?? null,
      checksum: input.checksum ?? null,
      title: input.title ?? null,
      status: 'active',
      createdByUserId: actor.sub,
    });
    await this.changeLog.record({
      entityType: 'media',
      entityId: asset.id,
      actorUserId: actor.sub,
      action: 'create',
      summary: `Registered media ${asset.kind}`,
    });
    return asset;
  }

  async softArchive(actor: DomainAccessActor, id: string) {
    this.access.assertStaff(actor);
    const asset = await this.assets.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('Media not found');
    const itemLinks = await this.itemMedia.count({ where: { assetId: id } });
    const groupLinks = await this.groupMedia.count({ where: { assetId: id } });
    if (itemLinks + groupLinks > 0) {
      throw new BadRequestException(
        'Нельзя удалить media: есть ссылки с заданий/групп. Сначала отвяжите.',
      );
    }
    asset.status = 'archived';
    await this.assets.save(asset);
    await this.changeLog.record({
      entityType: 'media',
      entityId: id,
      actorUserId: actor.sub,
      action: 'archive',
      summary: 'Soft-archived media asset',
    });
    return asset;
  }

  async linkItem(
    actor: DomainAccessActor,
    itemId: string,
    assetId: string,
    role = 'stimulus',
    sortOrder = 0,
  ) {
    this.access.assertStaff(actor);
    const asset = await this.assets.findOne({ where: { id: assetId, status: 'active' } });
    if (!asset) throw new NotFoundException('Media not found');
    return this.itemMedia.save({
      itemId,
      assetId,
      role,
      sortOrder,
    });
  }

  async linkGroup(
    actor: DomainAccessActor,
    groupId: string,
    assetId: string,
    role = 'stimulus',
    sortOrder = 0,
    cascadeToItems = true,
  ) {
    this.access.assertStaff(actor);
    const asset = await this.assets.findOne({ where: { id: assetId, status: 'active' } });
    if (!asset) throw new NotFoundException('Media not found');
    const link = await this.groupMedia.save({
      groupId,
      assetId,
      role,
      sortOrder,
    });
    // Cascade so Take/runtime (item-level attachments) sees the same audio.
    if (cascadeToItems) {
      const members = await this.groupItems.find({ where: { groupId } });
      for (const member of members) {
        const existing = await this.itemMedia.findOne({
          where: { itemId: member.itemId, assetId },
        });
        if (!existing) {
          await this.itemMedia.save({
            itemId: member.itemId,
            assetId,
            role,
            sortOrder,
          });
        }
      }
    }
    await this.changeLog.record({
      entityType: 'group',
      entityId: groupId,
      actorUserId: actor.sub,
      action: 'update',
      summary: `Linked media ${asset.kind} to group`,
    });
    return link;
  }
}
