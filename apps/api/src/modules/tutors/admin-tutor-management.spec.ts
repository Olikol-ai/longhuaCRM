import { ForbiddenException } from '@nestjs/common';
import { TutorAccessService } from '../../common/access/tutor-access.service';
import { TutorsService } from './tutors.service';

describe('Admin tutor management access', () => {
  const tutorA = 'tutor-a';
  const tutorB = 'tutor-b';

  describe('TutorAccessService isolation', () => {
    const tutorRepo = {
      findOne: jest.fn(),
    };
    const access = new TutorAccessService(tutorRepo as never);
    const admin = { sub: 'admin-1', email: 'admin@test.local', role: 'admin' };
    const tutorUser = { sub: 'user-a', email: 'tutor-a@test.local', role: 'tutor' };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('admin can read any tutor', async () => {
      await expect(
        access.assertCanReadTutor(admin, tutorB),
      ).resolves.toBeUndefined();
      expect(tutorRepo.findOne).not.toHaveBeenCalled();
    });

    it('tutor can read only own profile', async () => {
      tutorRepo.findOne.mockResolvedValue({ id: tutorA, userId: 'user-a' });
      await expect(
        access.assertCanReadTutor(tutorUser, tutorA),
      ).resolves.toBeUndefined();

      tutorRepo.findOne.mockResolvedValue({ id: tutorB, userId: 'user-b' });
      await expect(
        access.assertCanReadTutor(tutorUser, tutorB),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('scopeTutorFilter returns all for admin and self for tutor', async () => {
      const adminScoped = await access.scopeTutorFilter(admin, {});
      expect(adminScoped).toEqual({});

      const tutorScoped = await access.scopeTutorFilter(tutorUser, {});
      expect(tutorScoped).toEqual({ userId: 'user-a' });
    });
  });

  describe('admin notebook CRUD on behalf of tutor', () => {
    const tutorAccess = {
      resolveTutorId: jest.fn(),
      assertCanReadTutor: jest.fn().mockResolvedValue(undefined),
      scopeTutorFilter: jest.fn(),
    };
    const tutorStudentAccess = {
      assertCanListForTutor: jest.fn().mockResolvedValue(undefined),
      assertCanWriteTutorStudent: jest.fn(),
    };
    const tutorStudentRepo = {
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: unknown) => row),
      find: jest.fn(),
    };
    const lessonRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const service = new TutorsService(
      {} as never,
      tutorAccess as never,
      tutorStudentAccess as never,
      {} as never,
      {} as never,
      tutorStudentRepo as never,
      lessonRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const admin = { sub: 'admin-1', email: 'admin@test.local', role: 'admin' };

    beforeEach(() => {
      jest.clearAllMocks();
      tutorStudentAccess.assertCanListForTutor.mockResolvedValue(undefined);
      tutorStudentRepo.create.mockImplementation((row: unknown) => row);
      tutorStudentRepo.save.mockImplementation(async (row: unknown) => row);
    });

    it('admin creates notebook pupil for tutor without User/Student', async () => {
      const row = await service.createNotebookStudent(
        admin,
        { name: 'Пупкин Иван', phone: null, notes: 'админ добавил' },
        tutorA,
      );

      expect(tutorStudentAccess.assertCanListForTutor).toHaveBeenCalledWith(admin, tutorA);
      expect(tutorAccess.resolveTutorId).not.toHaveBeenCalled();
      expect(row).toEqual(
        expect.objectContaining({
          tutorId: tutorA,
          userId: null,
          email: null,
          notes: 'админ добавил',
          status: 'active',
        }),
      );
    });

    it('admin update rejects pupil from another tutor id path', async () => {
      tutorStudentAccess.assertCanWriteTutorStudent.mockResolvedValue({
        id: 'ts-1',
        tutorId: tutorB,
        name: 'Чужой',
      });

      await expect(
        service.updateNotebookStudent(
          admin,
          'ts-1',
          { name: 'Hack' },
          tutorA,
        ),
      ).rejects.toThrow('Ученик репетитора не найден');
    });

    it('listLessons asserts tutor read access', async () => {
      lessonRepo.find.mockResolvedValue([
        {
          id: 'l1',
          date: '2026-07-01',
          startTime: '10:00:00',
          duration: 60,
          status: 'completed',
          primaryTutorStudentId: 'ts-1',
          primaryTutorStudent: { name: 'Пупкин' },
          notes: null,
        },
      ]);

      const rows = await service.listLessons(admin, tutorA);
      expect(tutorAccess.assertCanReadTutor).toHaveBeenCalledWith(admin, tutorA);
      expect(rows[0]).toEqual(
        expect.objectContaining({
          id: 'l1',
          studentName: 'Пупкин',
          startTime: '10:00',
        }),
      );
    });
  });
});
