import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AssessmentBankEntity } from '../entities';
import { ContentLifecycleStatus } from '../enums';

@Injectable()
export class AssessmentBankRepository {
  constructor(
    @InjectRepository(AssessmentBankEntity)
    private readonly repo: Repository<AssessmentBankEntity>,
  ) {}

  findAll(): Promise<AssessmentBankEntity[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  findById(id: string): Promise<AssessmentBankEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  filter(where: FindOptionsWhere<AssessmentBankEntity>): Promise<AssessmentBankEntity[]> {
    return this.repo.find({ where, order: { name: 'ASC' } });
  }

  filterByStatus(status: ContentLifecycleStatus): Promise<AssessmentBankEntity[]> {
    return this.filter({ status });
  }

  save(entity: Partial<AssessmentBankEntity>): Promise<AssessmentBankEntity> {
    return this.repo.save(
      this.repo.create({ status: ContentLifecycleStatus.Draft, ...entity }),
    );
  }

  async update(
    id: string,
    data: Partial<AssessmentBankEntity>,
  ): Promise<AssessmentBankEntity | null> {
    await this.repo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
