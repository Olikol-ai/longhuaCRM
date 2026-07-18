import { ConflictException } from '@nestjs/common';
import { AssignmentService } from '../services/assignment.service';
import { AssessmentContentGuard } from '../services/assessment-content.guard';
import { AssignmentStatus } from '../enums';
import {
  AssessmentAssignmentRepository,
  AssessmentExamRepository,
} from '../repositories';

describe('AssignmentService', () => {
  const assignments = {
    findById: jest.fn(),
    update: jest.fn(),
    countStartedAttemptsForAssignment: jest.fn(),
    save: jest.fn(),
    findAll: jest.fn(),
    filterByExamId: jest.fn(),
  } as unknown as jest.Mocked<AssessmentAssignmentRepository>;

  const exams = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<AssessmentExamRepository>;

  const service = new AssignmentService(
    assignments,
    exams,
    new AssessmentContentGuard(),
    {
      assertCanCreateAssignment: jest.fn().mockResolvedValue(undefined),
      assertCanManageAssignment: jest.fn().mockResolvedValue(undefined),
      assertCanReadAssignment: jest.fn(),
      filterReadableAssignments: jest.fn(async (_a, rows) => rows),
    } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('assignment cannot cancel with started attempt', async () => {
    assignments.findById.mockResolvedValue({
      id: 'asg-1',
      status: AssignmentStatus.Active,
    } as never);
    assignments.countStartedAttemptsForAssignment.mockResolvedValue(1);

    await expect(service.cancel('asg-1', {
      sub: 'admin',
      role: 'admin',
      email: 'a@t.com',
    })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.cancel('asg-1', {
      sub: 'admin',
      role: 'admin',
      email: 'a@t.com',
    })).rejects.toThrow(
      /cannot be cancelled while an Attempt is in started state/,
    );
    expect(assignments.update).not.toHaveBeenCalled();
  });
});
