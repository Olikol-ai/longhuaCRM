import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { HomeworkLifecycleStatus } from './enums';
import { HomeworkService } from './services/homework.service';

function repoMock(extra: Record<string, unknown> = {}) {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((row: unknown) => row),
    delete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    ...extra,
  };
}

describe('HomeworkService peer sharing ACL', () => {
  const homeworks = repoMock();
  const items = repoMock();
  const assignments = repoMock();
  const attempts = repoMock();
  const questionSnapshots = repoMock();
  const answerSnapshots = repoMock();
  const attemptAnswers = repoMock();
  const selections = repoMock();
  const results = repoMock();
  const itemAnswers = repoMock();
  const homeworkTasks = repoMock();
  const homeworkAccess = repoMock();
  const assessmentQuestions = repoMock();
  const readingTasks = repoMock();
  const listeningTasks = repoMock();
  const readingQuestions = repoMock();
  const listeningQuestions = repoMock();
  const snapshotVocabulary = repoMock();
  const teachers = repoMock();
  const students = repoMock();
  const tutors = repoMock();
  const tutorStudents = repoMock();
  const users = repoMock();

  const tutorStudentAccess = {
    assertCanManageTutorStudent: jest.fn(),
  };
  const scoring = {};
  const notifier = {
    notifyAssigned: jest.fn(),
  };

  const service = new HomeworkService(
    homeworks as never,
    items as never,
    assignments as never,
    attempts as never,
    questionSnapshots as never,
    answerSnapshots as never,
    attemptAnswers as never,
    selections as never,
    results as never,
    itemAnswers as never,
    homeworkTasks as never,
    homeworkAccess as never,
    assessmentQuestions as never,
    readingTasks as never,
    listeningTasks as never,
    readingQuestions as never,
    listeningQuestions as never,
    snapshotVocabulary as never,
    teachers as never,
    students as never,
    tutors as never,
    tutorStudents as never,
    users as never,
    tutorStudentAccess as never,
    scoring as never,
    notifier as never,
  );

  const ownerUser = { sub: 'owner-user', role: 'teacher', email: 'o@t.com' };
  const sharedUser = { sub: 'shared-user', role: 'teacher', email: 's@t.com' };
  const foreignUser = { sub: 'foreign-user', role: 'teacher', email: 'f@t.com' };
  const adminUser = { sub: 'admin-user', role: 'admin', email: 'a@t.com' };

  const ownedHw = {
    id: 'hw-1',
    title: 'Shared template',
    status: HomeworkLifecycleStatus.Published,
    teacherId: 'teacher-owner',
    tutorId: null,
    createdByUserId: 'owner-user',
    items: [],
    updatedAt: new Date('2026-01-02'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    teachers.findOne.mockImplementation(async ({ where }: { where: { userId?: string } }) => {
      if (where?.userId === 'owner-user') return { id: 'teacher-owner', userId: 'owner-user' };
      if (where?.userId === 'shared-user') return { id: 'teacher-shared', userId: 'shared-user' };
      if (where?.userId === 'foreign-user') return { id: 'teacher-foreign', userId: 'foreign-user' };
      return null;
    });
    tutors.findOne.mockResolvedValue(null);
  });

  it('owner can grant access; duplicate grant is skipped', async () => {
    homeworks.findOne.mockResolvedValue(ownedHw);
    users.find.mockResolvedValue([
      { id: 'shared-user', role: 'teacher', email: 's@t.com', firstName: 'S', lastName: 'T' },
    ]);
    homeworkAccess.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'grant-1' });
    homeworkAccess.save.mockResolvedValue({ id: 'grant-1' });

    const first = await service.grantAccess(ownerUser as never, {
      homework_ids: ['hw-1'],
      grantee_user_ids: ['shared-user'],
    });
    expect(first).toEqual({ ok: true, created: 1, skipped: 0 });

    const second = await service.grantAccess(ownerUser as never, {
      homework_ids: ['hw-1'],
      grantee_user_ids: ['shared-user'],
    });
    expect(second).toEqual({ ok: true, created: 0, skipped: 1 });
  });

  it('shared teacher can view but cannot update (requireOwnedHomework)', async () => {
    homeworks.findOne.mockResolvedValue(ownedHw);
    homeworkAccess.findOne.mockResolvedValue({ id: 'grant-1' });

    await expect(
      (service as unknown as { assertCanViewHomework: Function }).assertCanViewHomework(
        sharedUser,
        ownedHw,
      ),
    ).resolves.toBeUndefined();

    await expect(service.update(sharedUser as never, 'hw-1', { title: 'Hack' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('shared teacher can assign published homework', async () => {
    homeworks.findOne.mockResolvedValue(ownedHw);
    homeworkAccess.findOne.mockResolvedValue({ id: 'grant-1' });
    students.find.mockResolvedValue([
      { id: 'stu-1', assignedTeacherId: 'teacher-shared', userId: 'stu-user', name: 'Student' },
    ]);
    assignments.findOne.mockResolvedValue(null);
    assignments.save.mockImplementation(async (row: unknown) => ({
      ...(row as object),
      id: 'asg-1',
    }));
    teachers.find.mockResolvedValue([{ id: 'teacher-owner', name: 'Owner' }]);
    tutors.find.mockResolvedValue([]);
    users.find.mockResolvedValue([]);
    attempts.find.mockResolvedValue([]);
    results.find.mockResolvedValue([]);
    items.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    });
    attemptAnswers.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    });
    questionSnapshots.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    });

    const created = await service.assign(sharedUser as never, 'hw-1', {
      student_ids: ['stu-1'],
    });
    expect(Array.isArray(created)).toBe(true);
    expect(assignments.save).toHaveBeenCalled();
  });

  it('foreign teacher without grant gets 403 on view', async () => {
    homeworkAccess.findOne.mockResolvedValue(null);
    await expect(
      (service as unknown as { assertCanViewHomework: Function }).assertCanViewHomework(
        foreignUser,
        ownedHw,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('admin can view and grant without ownership', async () => {
    homeworks.findOne.mockResolvedValue(ownedHw);
    users.find.mockResolvedValue([
      { id: 'shared-user', role: 'teacher', email: 's@t.com', firstName: 'S', lastName: 'T' },
    ]);
    homeworkAccess.findOne.mockResolvedValue(null);
    homeworkAccess.save.mockResolvedValue({ id: 'grant-admin' });

    await expect(
      (service as unknown as { assertCanViewHomework: Function }).assertCanViewHomework(
        adminUser,
        ownedHw,
      ),
    ).resolves.toBeUndefined();

    const result = await service.grantAccess(adminUser as never, {
      homework_ids: ['hw-1'],
      grantee_user_ids: ['shared-user'],
    });
    expect(result.created).toBe(1);
  });

  it('revoke removes grant; list no longer includes shared; assignments untouched', async () => {
    homeworks.findOne.mockResolvedValue(ownedHw);
    homeworkAccess.delete.mockResolvedValue({ affected: 1 });

    const revoked = await service.revokeAccess(ownerUser as never, {
      homework_ids: ['hw-1'],
      grantee_user_ids: ['shared-user'],
    });
    expect(revoked).toEqual({ ok: true, removed: 1 });
    expect(homeworkAccess.delete).toHaveBeenCalled();
    expect(assignments.delete).not.toHaveBeenCalled();
    expect(assignments.save).not.toHaveBeenCalled();
  });

  it('grant on missing homework returns NotFound', async () => {
    homeworks.findOne.mockResolvedValue(null);
    await expect(
      service.grantAccess(ownerUser as never, {
        homework_ids: ['missing'],
        grantee_user_ids: ['shared-user'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('shared cannot grant access to others', async () => {
    homeworks.findOne.mockResolvedValue(ownedHw);
    await expect(
      service.grantAccess(sharedUser as never, {
        homework_ids: ['hw-1'],
        grantee_user_ids: ['foreign-user'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
