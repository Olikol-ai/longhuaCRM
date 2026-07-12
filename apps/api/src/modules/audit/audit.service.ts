import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../../entities/audit-log.entity';

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.auditRepo.save(
        this.auditRepo.create({
          actorUserId: entry.actorUserId ?? null,
          action: entry.action,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          summary: entry.summary.slice(0, 4000),
        }),
      );
    } catch (error) {
      this.logger.warn(`Audit log write failed: ${(error as Error).message}`);
    }
  }
}
