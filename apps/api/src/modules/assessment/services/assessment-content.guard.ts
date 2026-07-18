import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentLifecycleStatus } from '../enums';

/** Shared guards for draft → published → archived content. */
@Injectable()
export class AssessmentContentGuard {
  requireFound<T>(entity: T | null | undefined, label: string): T {
    if (!entity) {
      throw new NotFoundException(`${label} not found`);
    }
    return entity;
  }

  assertDraft(status: ContentLifecycleStatus, label: string): void {
    if (status !== ContentLifecycleStatus.Draft) {
      throw new ConflictException(`${label} can only be edited while draft`);
    }
  }

  assertCanPublish(status: ContentLifecycleStatus, label: string): void {
    if (status !== ContentLifecycleStatus.Draft) {
      throw new ConflictException(`${label} can only be published from draft`);
    }
  }

  assertCanArchive(status: ContentLifecycleStatus, label: string): void {
    if (status === ContentLifecycleStatus.Archived) {
      throw new ConflictException(`${label} is already archived`);
    }
  }

  assertNotArchived(status: ContentLifecycleStatus, label: string): void {
    if (status === ContentLifecycleStatus.Archived) {
      throw new ConflictException(`${label} is archived and cannot be modified`);
    }
  }

  assertPublished(status: ContentLifecycleStatus, label: string): void {
    if (status !== ContentLifecycleStatus.Published) {
      throw new ConflictException(`${label} must be published`);
    }
  }
}
