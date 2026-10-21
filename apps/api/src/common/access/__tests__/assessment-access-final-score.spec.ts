import { ForbiddenException } from '@nestjs/common';
import { AssessmentAccessService } from '../assessment-access.service';

describe('AssessmentAccessService.assertCanAdjustFinalScore', () => {
  const studentRepo = { findOne: jest.fn() };
  const teacherRepo = { findOne: jest.fn() };
  const groupRepo = { findOne: jest.fn() };
  const groupMemberRepo = { findOne: jest.fn() };
  const enrollmentRepo = { findOne: jest.fn() };
  const examRepo = { findOne: jest.fn() };
  const assignmentRepo = { findOne: jest.fn() };
  const attemptRepo = { findOne: jest.fn() };
  const resultRepo = { findOne: jest.fn() };

  const access = new AssessmentAccessService(
    studentRepo as never,
    teacherRepo as never,
    groupRepo as never,
    groupMemberRepo as never,
    enrollmentRepo as never,
    examRepo as never,
    assignmentRepo as never,
    attemptRepo as never,
    resultRepo as never,
  );

  const result = {
    id: 'res-1',
    attemptId: 'att-1',
    examId: 'exam-1',
  };

  const actor = (sub: string, role: string) =>
    ({ sub, role, email: `${sub}@test.local` }) as never;

  beforeEach(() => {
    jest.clearAllMocks();
    resultRepo.findOne.mockResolvedValue(result);
    attemptRepo.findOne.mockResolvedValue({
      id: 'att-1',
      examId: 'exam-1',
      assignmentId: 'asg-1',
    });
    assignmentRepo.findOne.mockResolvedValue({
      id: 'asg-1',
      examId: 'exam-1',
      assignedByUserId: 'teacher-assigner',
    });
  });

  it('allows admin regardless of assigner', async () => {
    const out = await access.assertCanAdjustFinalScore(
      actor('admin-1', 'admin'),
      'res-1',
    );
    expect(out.id).toBe('res-1');
  });

  it('allows assigning teacher', async () => {
    const out = await access.assertCanAdjustFinalScore(
      actor('teacher-assigner', 'teacher'),
      'res-1',
    );
    expect(out.id).toBe('res-1');
  });

  it('denies other teacher even if they could view results elsewhere', async () => {
    await expect(
      access.assertCanAdjustFinalScore(actor('teacher-other', 'teacher'), 'res-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies student', async () => {
    await expect(
      access.assertCanAdjustFinalScore(actor('student-1', 'student'), 'res-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies when attempt has no assignment', async () => {
    attemptRepo.findOne.mockResolvedValue({
      id: 'att-1',
      examId: 'exam-1',
      assignmentId: null,
    });
    await expect(
      access.assertCanAdjustFinalScore(
        actor('teacher-assigner', 'teacher'),
        'res-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies ID swap when assignment exam mismatches result exam', async () => {
    assignmentRepo.findOne.mockResolvedValue({
      id: 'asg-1',
      examId: 'other-exam',
      assignedByUserId: 'teacher-assigner',
    });
    await expect(
      access.assertCanAdjustFinalScore(
        actor('teacher-assigner', 'teacher'),
        'res-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
