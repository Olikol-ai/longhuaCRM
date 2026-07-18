import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  AssessmentBlueprintEntity,
  AssessmentBlueprintSectionRuleEntity,
} from '../entities';
import { ContentLifecycleStatus } from '../enums';

@Injectable()
export class AssessmentBlueprintRepository {
  constructor(
    @InjectRepository(AssessmentBlueprintEntity)
    private readonly blueprintRepo: Repository<AssessmentBlueprintEntity>,
    @InjectRepository(AssessmentBlueprintSectionRuleEntity)
    private readonly sectionRuleRepo: Repository<AssessmentBlueprintSectionRuleEntity>,
  ) {}

  findAll(): Promise<AssessmentBlueprintEntity[]> {
    return this.blueprintRepo.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<AssessmentBlueprintEntity | null> {
    return this.blueprintRepo.findOne({ where: { id } });
  }

  filter(where: FindOptionsWhere<AssessmentBlueprintEntity>): Promise<AssessmentBlueprintEntity[]> {
    return this.blueprintRepo.find({ where, order: { name: 'ASC' } });
  }

  filterByExamTemplateId(examTemplateId: string): Promise<AssessmentBlueprintEntity[]> {
    return this.filter({ examTemplateId });
  }

  filterByStatus(status: ContentLifecycleStatus): Promise<AssessmentBlueprintEntity[]> {
    return this.filter({ status });
  }

  findWithSectionRules(id: string): Promise<AssessmentBlueprintEntity | null> {
    return this.blueprintRepo.findOne({
      where: { id },
      relations: ['sectionRules'],
    });
  }

  save(entity: Partial<AssessmentBlueprintEntity>): Promise<AssessmentBlueprintEntity> {
    return this.blueprintRepo.save(
      this.blueprintRepo.create({ status: ContentLifecycleStatus.Draft, ...entity }),
    );
  }

  async update(
    id: string,
    data: Partial<AssessmentBlueprintEntity>,
  ): Promise<AssessmentBlueprintEntity | null> {
    await this.blueprintRepo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.blueprintRepo.delete({ id });
  }

  async replaceSectionRules(
    blueprintId: string,
    rules: Partial<AssessmentBlueprintSectionRuleEntity>[],
  ): Promise<AssessmentBlueprintSectionRuleEntity[]> {
    return this.blueprintRepo.manager.transaction(async (manager) => {
      const sectionRuleRepo = manager.getRepository(AssessmentBlueprintSectionRuleEntity);
      await sectionRuleRepo.delete({ blueprintId });
      if (rules.length === 0) {
        return [];
      }
      const entities = rules.map((rule, index) =>
        sectionRuleRepo.create({
          blueprintId,
          sortOrder: rule.sortOrder ?? index,
          ...rule,
        }),
      );
      return sectionRuleRepo.save(entities);
    });
  }

  findSectionRulesByBlueprintId(
    blueprintId: string,
  ): Promise<AssessmentBlueprintSectionRuleEntity[]> {
    return this.sectionRuleRepo.find({
      where: { blueprintId },
      order: { sortOrder: 'ASC' },
    });
  }
}
