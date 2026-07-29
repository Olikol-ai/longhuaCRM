import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssessmentChangeJournalEntity } from '../entities';

export type AssessmentJournalEntry = {
  actorUserId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  oldVersion?: unknown;
  newVersion?: unknown;
};

@Injectable()
export class AssessmentChangeJournalService {
  private readonly logger = new Logger(AssessmentChangeJournalService.name);

  constructor(
    @InjectRepository(AssessmentChangeJournalEntity)
    private readonly journal: Repository<AssessmentChangeJournalEntity>,
  ) {}

  async record(entry: AssessmentJournalEntry): Promise<void> {
    try {
      await this.journal.save(
        this.journal.create({
          actorUserId: entry.actorUserId ?? null,
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          summary: entry.summary,
          oldVersion: this.serialize(entry.oldVersion),
          newVersion: this.serialize(entry.newVersion),
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Assessment journal write failed: ${(error as Error).message}`,
      );
    }
  }

  private serialize(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}
