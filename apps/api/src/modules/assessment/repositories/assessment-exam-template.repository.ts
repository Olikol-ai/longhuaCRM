import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AssessmentExamTemplateEntity } from '../entities';
import { ContentLifecycleStatus } from '../enums';

@Injectable()
export class AssessmentExamTemplateRepository {
  constructor(
    @InjectRepository(AssessmentExamTemplateEntity)
    private readonly repo: Repository<AssessmentExamTemplateEntity>,
  ) {}

  findAll(): Promise<AssessmentExamTemplateEntity[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<AssessmentExamTemplateEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  filter(
    where: FindOptionsWhere<AssessmentExamTemplateEntity>,
  ): Promise<AssessmentExamTemplateEntity[]> {
    return this.repo.find({ where, order: { name: 'ASC' } });
  }

  filterByStatus(status: ContentLifecycleStatus): Promise<AssessmentExamTemplateEntity[]> {
    return this.filter({ status });
  }

  save(entity: Partial<AssessmentExamTemplateEntity>): Promise<AssessmentExamTemplateEntity> {
    return this.repo.save(
      this.repo.create({ status: ContentLifecycleStatus.Draft, ...entity }),
    );
  }

  async update(
    id: string,
    data: Partial<AssessmentExamTemplateEntity>,
  ): Promise<AssessmentExamTemplateEntity | null> {
    await this.repo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
