import { Injectable } from '@nestjs/common';
import { AssessmentExamTemplateEntity } from '../entities';
import { ContentLifecycleStatus } from '../enums';
import { AssessmentExamTemplateRepository } from '../repositories';
import { AssessmentContentGuard } from './assessment-content.guard';

export type CreateExamTemplateInput = {
  name: string;
  description?: string | null;
  locale?: string | null;
  levelLabel?: string | null;
  createdByUserId?: string | null;
};

export type UpdateExamTemplateInput = {
  name?: string;
  description?: string | null;
  locale?: string | null;
  levelLabel?: string | null;
};

@Injectable()
export class ExamTemplateService {
  constructor(
    private readonly templates: AssessmentExamTemplateRepository,
    private readonly guard: AssessmentContentGuard,
  ) {}

  findById(id: string): Promise<AssessmentExamTemplateEntity | null> {
    return this.templates.findById(id);
  }

  list(status?: ContentLifecycleStatus): Promise<AssessmentExamTemplateEntity[]> {
    return status ? this.templates.filterByStatus(status) : this.templates.findAll();
  }

  create(input: CreateExamTemplateInput): Promise<AssessmentExamTemplateEntity> {
    return this.templates.save({
      name: input.name,
      description: input.description ?? null,
      locale: input.locale ?? null,
      levelLabel: input.levelLabel ?? null,
      createdByUserId: input.createdByUserId ?? null,
      status: ContentLifecycleStatus.Draft,
    });
  }

  async update(
    id: string,
    input: UpdateExamTemplateInput,
  ): Promise<AssessmentExamTemplateEntity> {
    const template = this.guard.requireFound(await this.templates.findById(id), 'ExamTemplate');
    this.guard.assertDraft(template.status, 'ExamTemplate');
    const updated = await this.templates.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.levelLabel !== undefined ? { levelLabel: input.levelLabel } : {}),
    });
    return this.guard.requireFound(updated, 'ExamTemplate');
  }

  async publish(id: string): Promise<AssessmentExamTemplateEntity> {
    const template = this.guard.requireFound(await this.templates.findById(id), 'ExamTemplate');
    this.guard.assertCanPublish(template.status, 'ExamTemplate');
    const updated = await this.templates.update(id, {
      status: ContentLifecycleStatus.Published,
    });
    return this.guard.requireFound(updated, 'ExamTemplate');
  }

  async archive(id: string): Promise<AssessmentExamTemplateEntity> {
    const template = this.guard.requireFound(await this.templates.findById(id), 'ExamTemplate');
    this.guard.assertCanArchive(template.status, 'ExamTemplate');
    const updated = await this.templates.update(id, {
      status: ContentLifecycleStatus.Archived,
    });
    return this.guard.requireFound(updated, 'ExamTemplate');
  }

  async deleteDraft(id: string): Promise<void> {
    const template = this.guard.requireFound(await this.templates.findById(id), 'ExamTemplate');
    this.guard.assertDraft(template.status, 'ExamTemplate');
    await this.templates.delete(id);
  }
}
