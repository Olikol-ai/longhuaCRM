import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { AssessmentAttemptEntity, AssessmentExamAssignmentEntity } from '../entities';
import { AttemptStatus } from '../enums';

@Injectable()
export class AssessmentAssignmentRepository {
  constructor(
    @InjectRepository(AssessmentExamAssignmentEntity)
    private readonly assignmentRepo: Repository<AssessmentExamAssignmentEntity>,
    @InjectRepository(AssessmentAttemptEntity)
    private readonly attemptRepo: Repository<AssessmentAttemptEntity>,
  ) {}

  findAll(): Promise<AssessmentExamAssignmentEntity[]> {
    return this.assignmentRepo.find({ order: { createdAt: 'DESC' } });
  }

  findById(id: string): Promise<AssessmentExamAssignmentEntity | null> {
    return this.assignmentRepo.findOne({ where: { id } });
  }

  filter(
    where: FindOptionsWhere<AssessmentExamAssignmentEntity>,
  ): Promise<AssessmentExamAssignmentEntity[]> {
    return this.assignmentRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  filterByExamId(examId: string): Promise<AssessmentExamAssignmentEntity[]> {
    return this.filter({ examId });
  }

  save(entity: Partial<AssessmentExamAssignmentEntity>): Promise<AssessmentExamAssignmentEntity> {
    return this.assignmentRepo.save(this.assignmentRepo.create(entity));
  }

  async update(
    id: string,
    data: Partial<AssessmentExamAssignmentEntity>,
  ): Promise<AssessmentExamAssignmentEntity | null> {
    await this.assignmentRepo.update({ id }, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.assignmentRepo.delete({ id });
  }

  countStartedAttemptsForAssignment(assignmentId: string): Promise<number> {
    return this.attemptRepo.count({
      where: { assignmentId, status: AttemptStatus.Started },
    });
  }
}
