import { ForbiddenException } from '@nestjs/common';
import { LessonAccessService } from './lesson-access.service';
import { LessonEntity } from '../../modules/lessons/entities/lesson.entity';

describe('LessonAccessService student video ACL', () => {
  const actor = (role: string, sub = 'user-1') =>
    ({ sub, role, email: `${role}@test.local` }) as const;

  const lessonRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const attendanceRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const groupMemberRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const studentAccess = {
    resolveStudentId: jest.fn(),
  };
  const teacherAccess = { resolveTeacherId: jest.fn() };
  const tutorAccess = { resolveTutorId: jest.fn() };
  const tutorStudentAccess = { resolveTutorStudentId: jest.fn() };

  const service = new LessonAccessService(
    lessonRepo as never,
    attendanceRepo as never,
    groupMemberRepo as never,
    studentAccess as never,
    teacherAccess as never,
    tutorAccess as never,
    tutorStudentAccess as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows student who is primaryStudentId', async () => {
    const lesson = {
      id: 'lesson-1',
      primaryStudentId: 'stu-1',
      groupId: null,
    } as LessonEntity;
    lessonRepo.findOne.mockResolvedValue(lesson);
    studentAccess.resolveStudentId.mockResolvedValue('stu-1');

    await expect(
      service.assertCanReadLesson(actor('student'), 'lesson-1'),
    ).resolves.toBe(lesson);
    expect(attendanceRepo.findOne).not.toHaveBeenCalled();
  });

  it('allows student with attendance row', async () => {
    const lesson = {
      id: 'lesson-1',
      primaryStudentId: 'other',
      groupId: null,
    } as LessonEntity;
    lessonRepo.findOne.mockResolvedValue(lesson);
    studentAccess.resolveStudentId.mockResolvedValue('stu-1');
    attendanceRepo.findOne.mockResolvedValue({ id: 'att-1' });

    await expect(
      service.assertCanReadLesson(actor('student'), 'lesson-1'),
    ).resolves.toBe(lesson);
  });

  it('allows group member even without attendance row', async () => {
    const lesson = {
      id: 'lesson-1',
      primaryStudentId: null,
      groupId: 'group-1',
    } as LessonEntity;
    lessonRepo.findOne.mockResolvedValue(lesson);
    studentAccess.resolveStudentId.mockResolvedValue('stu-1');
    attendanceRepo.findOne.mockResolvedValue(null);
    groupMemberRepo.findOne.mockResolvedValue({ id: 'gm-1', groupId: 'group-1', studentId: 'stu-1' });

    await expect(
      service.assertCanReadLesson(actor('student'), 'lesson-1'),
    ).resolves.toBe(lesson);
  });

  it('denies student who is not a participant', async () => {
    const lesson = {
      id: 'lesson-1',
      primaryStudentId: 'other',
      groupId: 'group-1',
    } as LessonEntity;
    lessonRepo.findOne.mockResolvedValue(lesson);
    studentAccess.resolveStudentId.mockResolvedValue('stu-1');
    attendanceRepo.findOne.mockResolvedValue(null);
    groupMemberRepo.findOne.mockResolvedValue(null);

    await expect(
      service.assertCanReadLesson(actor('student'), 'lesson-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows teacher only for own lesson', async () => {
    const lesson = {
      id: 'lesson-1',
      teacherId: 'teacher-1',
    } as LessonEntity;
    lessonRepo.findOne.mockResolvedValue(lesson);
    teacherAccess.resolveTeacherId.mockResolvedValue('teacher-1');
    await expect(
      service.assertCanReadLesson(actor('teacher', 't-user'), 'lesson-1'),
    ).resolves.toBe(lesson);

    teacherAccess.resolveTeacherId.mockResolvedValue('other-teacher');
    await expect(
      service.assertCanReadLesson(actor('teacher', 't-user'), 'lesson-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
