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
  ExamContentBulkJobEntity,
  ExamContentExportJobEntity,
  ExamContentImportJobEntity,
  ExamContentItemEntity,
  ExamContentItemStatsEntity,
} from '../entities';
import { ExamContentAccessService } from './exam-content-access.service';
import { ExamContentChangeLogService } from './exam-content-change-log.service';
import { CreateItemInput, ExamContentItemsService } from './exam-content-items.service';

@Injectable()
export class ExamContentOpsService {
  constructor(
    @InjectRepository(ExamContentImportJobEntity)
    private readonly imports: Repository<ExamContentImportJobEntity>,
    @InjectRepository(ExamContentExportJobEntity)
    private readonly exports: Repository<ExamContentExportJobEntity>,
    @InjectRepository(ExamContentBulkJobEntity)
    private readonly bulks: Repository<ExamContentBulkJobEntity>,
    @InjectRepository(ExamContentItemEntity)
    private readonly items: Repository<ExamContentItemEntity>,
    @InjectRepository(ExamContentItemStatsEntity)
    private readonly stats: Repository<ExamContentItemStatsEntity>,
    private readonly itemsService: ExamContentItemsService,
    private readonly access: ExamContentAccessService,
    private readonly changeLog: ExamContentChangeLogService,
  ) {}

  async startImport(
    actor: DomainAccessActor,
    input: { format: string; rows: Array<Partial<CreateItemInput> & { externalId?: string }> },
  ) {
    this.access.assertStaff(actor);
    await this.access.assertCanPublish(actor);
    const format = (input.format || 'json').toLowerCase();
    if (!['json', 'csv', 'xlsx'].includes(format)) {
      throw new BadRequestException('format: json|csv|xlsx');
    }
    const job = await this.imports.save({
      status: 'running',
      format,
      createdByUserId: actor.sub,
      totalRows: input.rows?.length || 0,
      successRows: 0,
      errorRows: 0,
      errorSummary: null,
      finishedAt: null,
    });

    const errors: string[] = [];
    let success = 0;
    for (const [idx, row] of (input.rows || []).entries()) {
      try {
        if (row.externalId) {
          const existing = await this.items.findOne({
            where: { externalId: row.externalId },
          });
          if (existing) {
            success += 1;
            continue;
          }
        }
        if (!row.versionId || !row.levelId || !row.sectionKey || !row.stem || !row.options) {
          throw new Error('missing required fields');
        }
        const created = await this.itemsService.create(actor, {
          versionId: row.versionId,
          levelId: row.levelId,
          sectionKey: row.sectionKey,
          itemTypeCode: row.itemTypeCode,
          topic: row.topic,
          difficulty: row.difficulty,
          recommendedTimeSeconds: row.recommendedTimeSeconds,
          stem: row.stem,
          explanation: row.explanation,
          options: row.options,
          vocabulary: row.vocabulary,
          grammar: row.grammar,
        });
        if (row.externalId) {
          created.item.externalId = row.externalId;
          await this.items.save(created.item);
        }
        success += 1;
      } catch (e) {
        errors.push(`row ${idx + 1}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    await this.imports.update(job.id, {
      successRows: success,
      errorRows: errors.length,
      errorSummary: errors.slice(0, 50).join('\n') || null,
      status: errors.length && !success ? 'failed' : 'completed',
      finishedAt: new Date(),
    });
    return this.imports.findOneOrFail({ where: { id: job.id } });
  }

  getImport(actor: DomainAccessActor, id: string) {
    this.access.assertStaff(actor);
    return this.imports.findOne({ where: { id } });
  }

  async startExport(
    actor: DomainAccessActor,
    input: { format: string; itemIds?: string[]; levelId?: string },
  ) {
    this.access.assertStaff(actor);
    const format = (input.format || 'json').toLowerCase();
    const job = await this.exports.save({
      status: 'running',
      format,
      createdByUserId: actor.sub,
      storageKey: null,
      errorSummary: null,
      finishedAt: null,
    });

    try {
      let rows: ExamContentItemEntity[] = [];
      if (input.itemIds?.length) {
        rows = await this.items.find({
          where: { id: In(input.itemIds) },
          relations: { vocabulary: true, grammar: true, media: true },
        });
      } else if (input.levelId) {
        rows = await this.items.find({
          where: { levelId: input.levelId },
          relations: { vocabulary: true, grammar: true, media: true },
          take: 2000,
        });
      } else {
        throw new BadRequestException('item_ids или level_id обязателен');
      }

      const manifest = {
        format,
        exportedAt: new Date().toISOString(),
        count: rows.length,
        items: rows.map((r) => ({
          id: r.id,
          externalId: r.externalId,
          levelId: r.levelId,
          versionId: r.versionId,
          sectionKey: r.sectionKey,
          itemTypeCode: r.itemTypeCode,
          topic: r.topic,
          difficulty: r.difficulty,
          status: r.status,
          engineContentId: r.engineContentId,
          contentKind: r.contentKind,
          vocabulary: r.vocabulary,
          grammar: r.grammar,
          media: (r.media || []).map((m) => ({
            assetId: m.assetId,
            role: m.role,
            sortOrder: m.sortOrder,
          })),
        })),
        mediaManifestNote:
          'Full zip with binaries is produced by storage worker when storage_key is set.',
      };

      await this.exports.update(job.id, {
        status: 'completed',
        storageKey: `inline:export:${job.id}`,
        finishedAt: new Date(),
      });
      const saved = await this.exports.findOneOrFail({ where: { id: job.id } });
      return { job: saved, manifest };
    } catch (e) {
      await this.exports.update(job.id, {
        status: 'failed',
        errorSummary: e instanceof Error ? e.message : String(e),
        finishedAt: new Date(),
      });
      throw e;
    }
  }

  getExport(actor: DomainAccessActor, id: string) {
    this.access.assertStaff(actor);
    return this.exports.findOne({ where: { id } });
  }

  async bulk(
    actor: DomainAccessActor,
    input: {
      action: string;
      itemIds: string[];
      patch?: {
        levelId?: string;
        topicId?: string | null;
        topic?: string | null;
        versionId?: string;
        status?: string;
      };
    },
  ) {
    this.access.assertStaff(actor);
    const action = input.action;
    if (!input.itemIds?.length) throw new BadRequestException('item_ids обязателен');

    const job = await this.bulks.save({
      status: 'running',
      action,
      payloadSummary: JSON.stringify({
        count: input.itemIds.length,
        patch: input.patch || null,
      }),
      createdByUserId: actor.sub,
      affectedCount: 0,
      finishedAt: null,
    });

    let affected = 0;
    if (action === 'archive' || action === 'publish' || action === 'submit_review') {
      await this.access.assertCanPublish(actor);
      // submit_review is legacy — review workflow removed; treat as publish.
      const status =
        action === 'archive' ? CONTENT_STATUS.Archived : CONTENT_STATUS.Published;
      for (const id of input.itemIds) {
        await this.itemsService.setStatus(actor, id, status);
        affected += 1;
      }
    } else if (action === 'set_meta') {
      const patch = input.patch || {};
      const result = await this.items.update(
        { id: In(input.itemIds) },
        {
          ...(patch.levelId ? { levelId: patch.levelId } : {}),
          ...(patch.versionId ? { versionId: patch.versionId } : {}),
          ...(patch.topicId !== undefined ? { topicId: patch.topicId } : {}),
          ...(patch.topic !== undefined ? { topic: patch.topic } : {}),
          editorUserId: actor.sub,
        },
      );
      affected = result.affected || 0;
    } else {
      throw new BadRequestException('Unknown bulk action');
    }

    await this.bulks.update(job.id, {
      affectedCount: affected,
      status: 'completed',
      finishedAt: new Date(),
    });
    await this.changeLog.record({
      entityType: 'bulk',
      entityId: job.id,
      actorUserId: actor.sub,
      action: 'bulk',
      summary: `${action} × ${affected}`,
    });
    return this.bulks.findOneOrFail({ where: { id: job.id } });
  }

  /** Batch recompute difficulty_index from answered/correct; discrimination placeholder. */
  async recomputeStats(actor: DomainAccessActor) {
    if (!this.access.isAdmin(actor)) {
      throw new BadRequestException('Admin only');
    }
    const rows = await this.stats.find({ take: 5000 });
    for (const row of rows) {
      if (row.timesAnswered > 0) {
        row.difficultyIndex = (row.timesCorrect / row.timesAnswered).toFixed(4);
      }
      // Discrimination requires attempt cohort join — compute high-low gap when enough data
      if (row.timesAnswered >= 20) {
        const p = Number(row.difficultyIndex || 0);
        row.discriminationIndex = (Math.min(1, Math.max(0, Math.abs(0.5 - p) * 2))).toFixed(4);
      }
      await this.stats.save(row);
    }
    return { updated: rows.length };
  }

  async getBulk(actor: DomainAccessActor, id: string) {
    this.access.assertStaff(actor);
    const job = await this.bulks.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Bulk job not found');
    return job;
  }
}
