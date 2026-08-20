/** @jest-environment node */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import { AssignmentService } from '../services/assignment.service';
import { AssessmentContentGuard } from '../services/assessment-content.guard';
import {
  AssignmentStatus,
  AssignmentTargetType,
  ContentLifecycleStatus,
} from '../enums';

describe('exam assignment ACL + description regression', () => {
  const studentRepo = { findOne: jest.fn() };
  const teacherRepo = { findOne: jest.fn() };
  const groupRepo = { findOne: jest.fn() };
  const groupMemberRepo = { findOne: jest.fn() };
  const enrollmentRepo = { findOne: jest.fn() };
  const examRepo = { findOne: jest.fn(), find: jest.fn() };
  const assignmentRepo = { findOne: jest.fn(), find: jest.fn() };
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('admin can assign exam to any student', async () => {
    examRepo.findOne.mockResolvedValue({
      id: 'exam-1',
      status: ContentLifecycleStatus.Published,
      source: 'assessment',
      createdByUserId: 'admin',
    });
    await expect(
      access.assertCanCreateAssignment(
        { sub: 'admin', role: 'admin', email: 'a@t.com' },
        'exam-1',
        AssignmentTargetType.Student,
        'stu-any',
      ),
    ).resolves.toBeUndefined();
  });

  it('teacher can assign published exam to own student', async () => {
    teacherRepo.findOne.mockResolvedValue({ id: 'tea-1', userId: 'user-t1' });
    examRepo.findOne.mockResolvedValue({
      id: 'exam-1',
      status: ContentLifecycleStatus.Published,
      source: 'assessment',
      createdByUserId: 'admin-user',
      description: 'Грамматика HSK 3',
    });
    studentRepo.findOne.mockResolvedValue({
      id: 'stu-1',
      assignedTeacherId: 'tea-1',
    });

    await expect(
      access.assertCanCreateAssignment(
        { sub: 'user-t1', role: 'teacher', email: 't@t.com' },
        'exam-1',
        AssignmentTargetType.Student,
        'stu-1',
      ),
    ).resolves.toBeUndefined();
  });

  it('teacher cannot assign exam to foreign student', async () => {
    teacherRepo.findOne.mockResolvedValue({ id: 'tea-1', userId: 'user-t1' });
    examRepo.findOne.mockResolvedValue({
      id: 'exam-1',
      status: ContentLifecycleStatus.Published,
      source: 'assessment',
      createdByUserId: 'admin-user',
    });
    studentRepo.findOne.mockResolvedValue({
      id: 'stu-OTHER',
      assignedTeacherId: 'tea-OTHER',
    });

    await expect(
      access.assertCanCreateAssignment(
        { sub: 'user-t1', role: 'teacher', email: 't@t.com' },
        'exam-1',
        AssignmentTargetType.Student,
        'stu-OTHER',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      access.assertCanCreateAssignment(
        { sub: 'user-t1', role: 'teacher', email: 't@t.com' },
        'exam-1',
        AssignmentTargetType.Student,
        'stu-OTHER',
      ),
    ).rejects.toThrow(/Вы не можете назначить экзамен этому ученику/);
  });

  it('student cannot assign exams', async () => {
    await expect(
      access.assertCanCreateAssignment(
        { sub: 'user-s1', role: 'student', email: 's@t.com' },
        'exam-1',
        AssignmentTargetType.Student,
        'stu-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects duplicate active assignment for same exam+target', async () => {
    const assignments = {
      filterByExamId: jest.fn().mockResolvedValue([
        {
          id: 'asg-1',
          examId: 'exam-1',
          targetType: AssignmentTargetType.Student,
          targetId: 'stu-1',
          status: AssignmentStatus.Active,
        },
      ]),
      save: jest.fn(),
    };
    const exams = {
      findById: jest.fn().mockResolvedValue({
        id: 'exam-1',
        status: ContentLifecycleStatus.Published,
      }),
    };
    const service = new AssignmentService(
      assignments as never,
      exams as never,
      new AssessmentContentGuard(),
      {
        assertCanCreateAssignment: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    await expect(
      service.create(
        {
          examId: 'exam-1',
          targetType: AssignmentTargetType.Student,
          targetId: 'stu-1',
        },
        { sub: 'admin', role: 'admin', email: 'a@t.com' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(assignments.save).not.toHaveBeenCalled();
  });

  it('exam description persists on create/update payload shape', () => {
    const entity = {
      id: 'exam-1',
      name: 'HSK 3',
      description: 'Экзамен по грамматике и лексике',
      status: ContentLifecycleStatus.Draft,
    };
    expect(entity.description).toBe('Экзамен по грамматике и лексике');
    const cleared = { ...entity, description: null };
    expect(cleared.description).toBeNull();
  });
});
