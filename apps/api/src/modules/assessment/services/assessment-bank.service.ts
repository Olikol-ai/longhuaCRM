import { Injectable } from '@nestjs/common';
import { AssessmentBankEntity } from '../entities';
import { ContentLifecycleStatus } from '../enums';
import { AssessmentBankRepository } from '../repositories';
import { AssessmentContentGuard } from './assessment-content.guard';

export type CreateBankInput = {
  name: string;
  description?: string | null;
  locale?: string | null;
  createdByUserId?: string | null;
};

export type UpdateBankInput = {
  name?: string;
  description?: string | null;
  locale?: string | null;
};

@Injectable()
export class AssessmentBankService {
  constructor(
    private readonly banks: AssessmentBankRepository,
    private readonly guard: AssessmentContentGuard,
  ) {}

  findById(id: string): Promise<AssessmentBankEntity | null> {
    return this.banks.findById(id);
  }

  list(status?: ContentLifecycleStatus): Promise<AssessmentBankEntity[]> {
    return status ? this.banks.filterByStatus(status) : this.banks.findAll();
  }

  create(input: CreateBankInput): Promise<AssessmentBankEntity> {
    return this.banks.save({
      name: input.name,
      description: input.description ?? null,
      locale: input.locale ?? null,
      createdByUserId: input.createdByUserId ?? null,
      status: ContentLifecycleStatus.Draft,
    });
  }

  async update(id: string, input: UpdateBankInput): Promise<AssessmentBankEntity> {
    const bank = this.guard.requireFound(await this.banks.findById(id), 'Bank');
    this.guard.assertDraft(bank.status, 'Bank');
    const updated = await this.banks.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
    });
    return this.guard.requireFound(updated, 'Bank');
  }

  async publish(id: string): Promise<AssessmentBankEntity> {
    const bank = this.guard.requireFound(await this.banks.findById(id), 'Bank');
    this.guard.assertCanPublish(bank.status, 'Bank');
    const updated = await this.banks.update(id, { status: ContentLifecycleStatus.Published });
    return this.guard.requireFound(updated, 'Bank');
  }

  async archive(id: string): Promise<AssessmentBankEntity> {
    const bank = this.guard.requireFound(await this.banks.findById(id), 'Bank');
    this.guard.assertCanArchive(bank.status, 'Bank');
    const updated = await this.banks.update(id, { status: ContentLifecycleStatus.Archived });
    return this.guard.requireFound(updated, 'Bank');
  }
}
