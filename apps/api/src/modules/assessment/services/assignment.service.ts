import { ConflictException, Injectable } from '@nestjs/common';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { AssessmentExamAssignmentEntity } from '../entities';
import { AssignmentStatus, AssignmentTargetType, ContentLifecycleStatus } from '../enums';
import {
  AssessmentAssignmentRepository,
  AssessmentExamRepository,
} from '../repositories';
import { AssessmentContentGuard } from './assessment-content.guard';

export type CreateAssignmentInput = {
  examId: string;
  targetType: AssignmentTargetType;
  targetId: string;
  validFrom?: Date | null;
  validTo?: Date | null;
  assessmentRuleOverrideId?: string | null;
  assignedByUserId?: string | null;
  /** Initial status; default draft. May be scheduled/active based on window. */
  status?: AssignmentStatus;
};

@Injectable()
export class AssignmentService {
  constructor(
    private readonly assignments: AssessmentAssignmentRepository,
    private readonly exams: AssessmentExamRepository,
    private readonly guard: AssessmentContentGuard,
    private readonly access: AssessmentAccessService,
  ) {}

  findById(id: string): Promise<AssessmentExamAssignmentEntity | null> {
    return this.assignments.findById(id);
  }

  async getForActor(
    id: string,
    actor: DomainAccessActor,
  ): Promise<AssessmentExamAssignmentEntity> {
    return this.access.assertCanReadAssignment(actor, id);
  }

  listByExam(examId: string): Promise<AssessmentExamAssignmentEntity[]> {
    return this.assignments.filterByExamId(examId);
  }

  async listFiltered(
    filter: {
      examId?: string;
      targetType?: AssignmentTargetType;
      targetId?: string;
      active?: boolean;
    } = {},
    actor?: DomainAccessActor,
  ): Promise<AssessmentExamAssignmentEntity[]> {
    let rows: AssessmentExamAssignmentEntity[];
    if (filter.examId) {
      rows = await this.assignments.filterByExamId(filter.examId);
    } else {
      rows = await this.assignments.findAll();
    }

    if (filter.targetType) {
      rows = rows.filter((r) => r.targetType === filter.targetType);
    }
    if (filter.targetId) {
      rows = rows.filter((r) => r.targetId === filter.targetId);
    }
    if (filter.active === true) {
      rows = rows.filter((r) => r.status === AssignmentStatus.Active);
    } else if (filter.active === false) {
      rows = rows.filter((r) => r.status !== AssignmentStatus.Active);
    }

    if (actor) {
      rows = await this.access.filterReadableAssignments(actor, rows);
    }
    return rows;
  }

  async create(
    input: CreateAssignmentInput,
    actor: DomainAccessActor,
  ): Promise<AssessmentExamAssignmentEntity> {
    await this.access.assertCanCreateAssignment(
      actor,
      input.examId,
      input.targetType,
      input.targetId,
    );

    const exam = this.guard.requireFound(await this.exams.findById(input.examId), 'Exam');
    if (exam.status !== ContentLifecycleStatus.Published) {
      throw new ConflictException('Assignment can only be created for a published Exam');
    }

    const existingForExam = await this.assignments.filterByExamId(input.examId);
    const duplicate = existingForExam.find(
      (row) =>
        row.targetType === input.targetType &&
        row.targetId === input.targetId &&
        row.status !== AssignmentStatus.Cancelled &&
        row.status !== AssignmentStatus.Completed,
    );
    if (duplicate) {
      throw new ConflictException(
        'Этот экзамен уже назначен данному получателю',
      );
    }

    const status = input.status ?? this.resolveInitialStatus(input.validFrom);

    return this.assignments.save({
      examId: input.examId,
      targetType: input.targetType,
      targetId: input.targetId,
      status,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      assessmentRuleOverrideId: input.assessmentRuleOverrideId ?? null,
      assignedByUserId: input.assignedByUserId ?? actor.sub,
    });
  }

  async cancel(
    id: string,
    actor: DomainAccessActor,
  ): Promise<AssessmentExamAssignmentEntity> {
    await this.access.assertCanManageAssignment(actor, id);

    const assignment = this.guard.requireFound(
      await this.assignments.findById(id),
      'Assignment',
    );
    if (
      assignment.status === AssignmentStatus.Cancelled ||
      assignment.status === AssignmentStatus.Completed
    ) {
      throw new ConflictException('Assignment is already terminal');
    }

    const started = await this.assignments.countStartedAttemptsForAssignment(id);
    if (started > 0) {
      throw new ConflictException(
        'Assignment cannot be cancelled while an Attempt is in started state',
      );
    }

    const updated = await this.assignments.update(id, {
      status: AssignmentStatus.Cancelled,
    });
    return this.guard.requireFound(updated, 'Assignment');
  }

  async activate(id: string): Promise<AssessmentExamAssignmentEntity> {
    const assignment = this.guard.requireFound(
      await this.assignments.findById(id),
      'Assignment',
    );
    if (
      assignment.status !== AssignmentStatus.Draft &&
      assignment.status !== AssignmentStatus.Scheduled
    ) {
      throw new ConflictException('Assignment can only be activated from draft or scheduled');
    }
    const updated = await this.assignments.update(id, { status: AssignmentStatus.Active });
    return this.guard.requireFound(updated, 'Assignment');
  }

  private resolveInitialStatus(validFrom?: Date | null): AssignmentStatus {
    if (validFrom && validFrom.getTime() > Date.now()) {
      return AssignmentStatus.Scheduled;
    }
    return AssignmentStatus.Active;
  }
}
