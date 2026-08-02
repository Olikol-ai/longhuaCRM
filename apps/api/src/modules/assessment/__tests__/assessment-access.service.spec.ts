import { ForbiddenException } from '@nestjs/common';
import { AssessmentAccessService } from '../../../common/access/assessment-access.service';
import {
  AssignmentTargetType,
  ContentLifecycleStatus,
} from '../enums';

describe('AssessmentAccessService ACL', () => {
  const studentRepo = {
    findOne: jest.fn(),
  };
  const teacherRepo = {
    findOne: jest.fn(),
  };
  const groupRepo = {
    findOne: jest.fn(),
  };
  const groupMemberRepo = {
    findOne: jest.fn(),
  };
  const enrollmentRepo = {
    findOne: jest.fn(),
  };
  const examRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const assignmentRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const attemptRepo = {
    findOne: jest.fn(),
  };
  const resultRepo = {
    findOne: jest.fn(),
  };

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

  it('student cannot read foreign assignment', async () => {
    studentRepo.findOne.mockResolvedValue({ id: 'stu-1', userId: 'user-s1' });
    assignmentRepo.findOne.mockResolvedValue({
      id: 'asg-1',
      examId: 'exam-1',
      targetType: AssignmentTargetType.Student,
      targetId: 'stu-OTHER',
    });

    await expect(
      access.assertCanReadAssignment(
        { sub: 'user-s1', role: 'student', email: 's@t.com' },
        'asg-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('student cannot start foreign attempt (no assignment)', async () => {
    studentRepo.findOne.mockResolvedValue({ id: 'stu-1', userId: 'user-s1' });
    examRepo.findOne.mockResolvedValue({
      id: 'exam-1',
      status: ContentLifecycleStatus.Published,
      createdByUserId: 'teacher-user',
    });
    assignmentRepo.find.mockResolvedValue([
      {
        id: 'asg-1',
        examId: 'exam-1',
        targetType: AssignmentTargetType.Student,
        targetId: 'stu-OTHER',
      },
    ]);
    assignmentRepo.findOne.mockResolvedValue(null);

    await expect(
      access.assertCanStartAttempt(
        { sub: 'user-s1', role: 'student', email: 's@t.com' },
        'exam-1',
        null,
      ),
    ).rejects.toThrow(/no Assignment|not assigned|Forbidden/);
  });

  it('teacher cannot access another teacher result', async () => {
    teacherRepo.findOne.mockResolvedValue({ id: 'tea-1', userId: 'user-t1' });
    resultRepo.findOne.mockResolvedValue({
      id: 'res-1',
      attemptId: 'att-1',
      examId: 'exam-1',
    });
    attemptRepo.findOne.mockResolvedValue({
      id: 'att-1',
      userId: 'user-s2',
      studentId: 'stu-2',
      teacherId: null,
      examId: 'exam-1',
    });
    studentRepo.findOne.mockResolvedValue({
      id: 'stu-2',
      assignedTeacherId: 'tea-OTHER',
    });
    examRepo.findOne.mockResolvedValue({
      id: 'exam-1',
      createdByUserId: 'user-t-OTHER',
    });

    await expect(
      access.assertCanReadResult(
        { sub: 'user-t1', role: 'teacher', email: 't@t.com' },
        'res-1',
      ),
    ).rejects.toThrow(/another teacher Result|Forbidden/);
  });

  it('admin can delete any question', () => {
    expect(() =>
      access.assertCanDeleteQuestion(
        { sub: 'admin-1', role: 'admin', email: 'a@t.com' },
        { createdByUserId: 'someone-else' },
      ),
    ).not.toThrow();
  });

  it('author teacher can delete own question', () => {
    expect(() =>
      access.assertCanDeleteQuestion(
        { sub: 'user-t1', role: 'teacher', email: 't@t.com' },
        { createdByUserId: 'user-t1' },
      ),
    ).not.toThrow();
  });

  it('other teacher cannot delete foreign question', () => {
    expect(() =>
      access.assertCanDeleteQuestion(
        { sub: 'user-t1', role: 'teacher', email: 't@t.com' },
        { createdByUserId: 'user-t-OTHER' },
      ),
    ).toThrow(ForbiddenException);
  });

  it('tutor can delete own question but not foreign question', () => {
    expect(() =>
      access.assertCanDeleteQuestion(
        { sub: 'user-u1', role: 'tutor', email: 'u@t.com' },
        { createdByUserId: 'user-u1' },
      ),
    ).not.toThrow();

    expect(() =>
      access.assertCanDeleteQuestion(
        { sub: 'user-u1', role: 'tutor', email: 'u@t.com' },
        { createdByUserId: 'user-t-OTHER' },
      ),
    ).toThrow(ForbiddenException);
  });

  it('tutor can manage own exam but not foreign teacher exam', async () => {
    examRepo.findOne
      .mockResolvedValueOnce({
        id: 'exam-own',
        createdByUserId: 'user-u1',
      })
      .mockResolvedValueOnce({
        id: 'exam-foreign',
        createdByUserId: 'user-t-OTHER',
      });

    await expect(
      access.assertCanManageExam(
        { sub: 'user-u1', role: 'tutor', email: 'u@t.com' },
        'exam-own',
      ),
    ).resolves.toBeDefined();

    await expect(
      access.assertCanManageExam(
        { sub: 'user-u1', role: 'tutor', email: 'u@t.com' },
        'exam-foreign',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('admin bypass works', async () => {
    assignmentRepo.findOne.mockResolvedValue({
      id: 'asg-1',
      examId: 'exam-1',
      targetType: AssignmentTargetType.Student,
      targetId: 'anyone',
    });
    examRepo.findOne.mockResolvedValue({
      id: 'exam-1',
      status: ContentLifecycleStatus.Draft,
      createdByUserId: 'someone',
    });
    resultRepo.findOne.mockResolvedValue({
      id: 'res-1',
      attemptId: 'att-1',
    });
    attemptRepo.findOne.mockResolvedValue({
      id: 'att-1',
      userId: 'other',
      studentId: 'stu-x',
      examId: 'exam-1',
    });

    const admin = { sub: 'admin-1', role: 'admin', email: 'a@t.com' };

    await expect(access.assertCanReadAssignment(admin, 'asg-1')).resolves.toBeDefined();
    await expect(access.assertCanManageExam(admin, 'exam-1')).resolves.toBeDefined();
    await expect(access.assertCanReadResult(admin, 'res-1')).resolves.toBeDefined();
  });

  it('HSK Academy ECP materialization: student can start own exam_content without assignment', async () => {
    examRepo.findOne.mockResolvedValue({
      id: 'exam-ecp-1',
      source: 'exam_content',
      status: ContentLifecycleStatus.Published,
      createdByUserId: 'user-s1',
    });

    await expect(
      access.assertCanStartAttempt(
        { sub: 'user-s1', role: 'student', email: 's@t.com' },
        'exam-ecp-1',
        null,
      ),
    ).resolves.toBeUndefined();
  });

  it('HSK Academy ECP materialization: teacher/tutor/admin can start own exam_content', async () => {
    for (const role of ['teacher', 'tutor', 'admin'] as const) {
      examRepo.findOne.mockResolvedValue({
        id: `exam-${role}`,
        source: 'exam_content',
        status: ContentLifecycleStatus.Published,
        createdByUserId: `user-${role}`,
      });
      await expect(
        access.assertCanStartAttempt(
          { sub: `user-${role}`, role, email: `${role}@t.com` },
          `exam-${role}`,
          null,
        ),
      ).resolves.toBeUndefined();
    }
  });

  it('HSK Academy ECP materialization: student can read own exam_content', async () => {
    examRepo.findOne.mockResolvedValue({
      id: 'exam-ecp-2',
      source: 'exam_content',
      status: ContentLifecycleStatus.Published,
      createdByUserId: 'user-s1',
    });

    await expect(
      access.assertCanReadExam(
        { sub: 'user-s1', role: 'student', email: 's@t.com' },
        'exam-ecp-2',
      ),
    ).resolves.toMatchObject({ id: 'exam-ecp-2' });
  });

  it('regular assessment exam still requires assignment for student', async () => {
    examRepo.findOne.mockResolvedValue({
      id: 'exam-asg',
      source: 'assessment',
      status: ContentLifecycleStatus.Published,
      createdByUserId: 'user-s1',
    });
    assignmentRepo.find.mockResolvedValue([]);
    assignmentRepo.findOne.mockResolvedValue(null);

    await expect(
      access.assertCanStartAttempt(
        { sub: 'user-s1', role: 'student', email: 's@t.com' },
        'exam-asg',
        null,
      ),
    ).rejects.toThrow(/no Assignment|not assigned|Forbidden/);
  });
});
