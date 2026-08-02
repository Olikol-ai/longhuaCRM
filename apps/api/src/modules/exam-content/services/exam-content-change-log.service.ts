import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamContentChangeLogEntity } from '../entities';

@Injectable()
export class ExamContentChangeLogService {
  constructor(
    @InjectRepository(ExamContentChangeLogEntity)
    private readonly log: Repository<ExamContentChangeLogEntity>,
  ) {}

  async record(input: {
    entityType: string;
    entityId: string;
    actorUserId: string | null;
    action: string;
    summary?: string | null;
    beforeRevision?: number | null;
    afterRevision?: number | null;
  }) {
    return this.log.save({
      entityType: input.entityType,
      entityId: input.entityId,
      actorUserId: input.actorUserId,
      action: input.action,
      summary: input.summary ?? null,
      beforeRevision: input.beforeRevision ?? null,
      afterRevision: input.afterRevision ?? null,
    });
  }

  listForEntity(entityType: string, entityId: string) {
    return this.log.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
}
