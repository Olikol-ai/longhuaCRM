import { Injectable } from '@nestjs/common';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
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
    private readonly access: AssessmentAccessService,
  ) {}

  findById(id: string): Promise<AssessmentBankEntity | null> {
    return this.banks.findById(id);
  }

  async getForActor(
    actor: DomainAccessActor,
    id: string,
  ): Promise<AssessmentBankEntity> {
    const bank = this.guard.requireFound(await this.banks.findById(id), 'Bank');
    this.access.assertCanManageCreatedContent(actor, bank, 'bank');
    return bank;
  }

  list(status?: ContentLifecycleStatus): Promise<AssessmentBankEntity[]> {
    return status ? this.banks.filterByStatus(status) : this.banks.findAll();
  }

  async listForActor(
    actor: DomainAccessActor,
    status?: ContentLifecycleStatus,
  ): Promise<AssessmentBankEntity[]> {
    const items = await this.list(status);
    if (this.access.isAdmin(actor)) {
      return items;
    }
    return items.filter((item) => this.access.canManageCreatedContent(actor, item));
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

  async update(
    actor: DomainAccessActor,
    id: string,
    input: UpdateBankInput,
  ): Promise<AssessmentBankEntity> {
    const bank = await this.getForActor(actor, id);
    this.guard.assertDraft(bank.status, 'Bank');
    const updated = await this.banks.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
    });
    return this.guard.requireFound(updated, 'Bank');
  }

  async publish(actor: DomainAccessActor, id: string): Promise<AssessmentBankEntity> {
    const bank = await this.getForActor(actor, id);
    this.guard.assertCanPublish(bank.status, 'Bank');
    const updated = await this.banks.update(id, { status: ContentLifecycleStatus.Published });
    return this.guard.requireFound(updated, 'Bank');
  }

  async archive(actor: DomainAccessActor, id: string): Promise<AssessmentBankEntity> {
    const bank = await this.getForActor(actor, id);
    this.guard.assertCanArchive(bank.status, 'Bank');
    const updated = await this.banks.update(id, { status: ContentLifecycleStatus.Archived });
    return this.guard.requireFound(updated, 'Bank');
  }

  async deleteDraft(actor: DomainAccessActor, id: string): Promise<void> {
    const bank = await this.getForActor(actor, id);
    this.guard.assertDraft(bank.status, 'Bank');
    await this.banks.delete(id);
  }
}
