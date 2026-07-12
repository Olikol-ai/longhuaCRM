import { Injectable, Logger } from '@nestjs/common';
import { AuditRepository, AuditEntry } from './audit.repository';
export type { AuditEntry } from './audit.repository';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditRepository: AuditRepository) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.auditRepository.save(entry);
    } catch (error) {
      this.logger.warn(`Audit log write failed: ${(error as Error).message}`);
    }
  }
}
