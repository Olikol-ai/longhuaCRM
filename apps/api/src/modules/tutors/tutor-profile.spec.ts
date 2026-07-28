import { ForbiddenException } from '@nestjs/common';
import { TutorAccessService } from '../../common/access/tutor-access.service';
import { TUTOR_SELF_UPDATE_FIELDS } from '../../common/access/domain-access.types';
import { TutorsService } from './tutors.service';

describe('Tutor self profile management', () => {
  const tutorId = 'tutor-1';
  const otherTutorId = 'tutor-2';

  const tutorActor = {
    sub: 'user-tutor-1',
    email: 'tutor@test.local',
    role: 'tutor' as const,
  };
  const adminActor = {
    sub: 'admin-1',
    email: 'admin@test.local',
    role: 'admin' as const,
  };

  describe('TutorAccessService field filtering', () => {
    const tutorRepo = { findOne: jest.fn() };
    const access = new TutorAccessService(tutorRepo as never);

    beforeEach(() => {
      jest.clearAllMocks();
      tutorRepo.findOne.mockResolvedValue({ id: tutorId, userId: 'user-tutor-1' });
    });

    it('allows tutor to update own profile fields including settings', async () => {
      const dto = {
        displayName: 'Иван Репетитор',
        bio: 'О себе',
        teachingExperience: '5 лет',
        specialization: 'Китайский язык',
        learningDirections: ['HSK', 'разговорный китайский'],
        teachingLanguages: ['Русский'],
        lessonDurations: [30, 60],
        workDays: [0, 1, 2],
        workTimeFrom: '10:00',
        workTimeTo: '19:00',
        defaultLessonPrice: 40,
        status: 'inactive',
        commissionPercent: 99,
      };

      const allowed = await access.assertCanUpdateTutor(tutorActor, tutorId, dto);
      expect(allowed.displayName).toBe('Иван Репетитор');
      expect(allowed.learningDirections).toEqual(['HSK', 'разговорный китайский']);
      expect(allowed.lessonDurations).toEqual([30, 60]);
      expect(allowed.defaultLessonPrice).toBe(40);
      expect(allowed.status).toBeUndefined();
      expect(allowed.commissionPercent).toBeUndefined();
      for (const key of Object.keys(allowed)) {
        expect(TUTOR_SELF_UPDATE_FIELDS).toContain(key as never);
      }
    });

    it('forbids tutor from updating another tutor', async () => {
      tutorRepo.findOne.mockResolvedValue({ id: otherTutorId, userId: 'someone-else' });
      await expect(
        access.assertCanUpdateTutor(tutorActor, otherTutorId, { displayName: 'Hack' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('admin can update any field on any tutor', async () => {
      const dto = {
        displayName: 'Админ правки',
        status: 'active',
        commissionPercent: 1,
        lessonDurations: [90],
      };
      const allowed = await access.assertCanUpdateTutor(adminActor, otherTutorId, dto);
      expect(allowed).toEqual(dto);
    });
  });

  describe('TutorsService persists profile collections', () => {
    const tutorAccess = {
      resolveTutorId: jest.fn(),
      assertCanReadTutor: jest.fn(),
      assertCanUpdateTutor: jest.fn(),
      scopeTutorFilter: jest.fn(),
    };
    const repository = {
      update: jest.fn(),
      findById: jest.fn(),
    };
    const directionRepo = {
      delete: jest.fn(),
      save: jest.fn(async (rows: unknown) => rows),
      create: jest.fn((row: unknown) => row),
    };
    const languageRepo = {
      delete: jest.fn(),
      save: jest.fn(async (rows: unknown) => rows),
      create: jest.fn((row: unknown) => row),
    };
    const durationRepo = {
      delete: jest.fn(),
      save: jest.fn(async (rows: unknown) => rows),
      create: jest.fn((row: unknown) => row),
    };
    const workDayRepo = {
      delete: jest.fn(),
      save: jest.fn(async (rows: unknown) => rows),
      create: jest.fn((row: unknown) => row),
    };
    const roleEntitySync = {
      syncLinkedUserFromTutor: jest.fn(),
    };

    const service = new TutorsService(
      repository as never,
      tutorAccess as never,
      {} as never,
      {} as never,
      roleEntitySync as never,
      {} as never,
      {} as never,
      directionRepo as never,
      languageRepo as never,
      durationRepo as never,
      workDayRepo as never,
      {} as never,
    );

    beforeEach(() => {
      jest.clearAllMocks();
      tutorAccess.assertCanUpdateTutor.mockImplementation(
        async (_actor: unknown, _id: string, dto: Record<string, unknown>) => dto,
      );
      repository.update.mockResolvedValue({
        id: tutorId,
        userId: 'user-tutor-1',
        displayName: 'Иван',
      });
      repository.findById.mockResolvedValue({
        id: tutorId,
        displayName: 'Иван',
        learningDirections: [{ name: 'HSK' }],
        lessonDurations: [{ minutes: 60 }],
      });
    });

    it('saves directions, durations and work days for tutor', async () => {
      const row = await service.update(tutorActor, tutorId, {
        displayName: 'Иван Репетитор',
        specialization: 'Китайский язык',
        learningDirections: ['HSK', 'бизнес-китайский'],
        teachingLanguages: ['Русский', 'Английский'],
        lessonDurations: [60, 90],
        workDays: [0, 2, 4],
        workTimeFrom: '09:00',
        workTimeTo: '18:00',
        defaultLessonPrice: 55,
      });

      expect(repository.update).toHaveBeenCalledWith(
        tutorId,
        expect.objectContaining({
          displayName: 'Иван Репетитор',
          specialization: 'Китайский язык',
          workTimeFrom: '09:00',
          workTimeTo: '18:00',
          defaultLessonPrice: 55,
        }),
      );
      expect(directionRepo.delete).toHaveBeenCalledWith({ tutorId });
      expect(directionRepo.save).toHaveBeenCalled();
      expect(languageRepo.save).toHaveBeenCalled();
      expect(durationRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ minutes: 60 }),
          expect.objectContaining({ minutes: 90 }),
        ]),
      );
      expect(workDayRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ dayOfWeek: 0 }),
          expect.objectContaining({ dayOfWeek: 2 }),
          expect.objectContaining({ dayOfWeek: 4 }),
        ]),
      );
      expect(row.id).toBe(tutorId);
    });

    it('rejects invalid lesson duration', async () => {
      await expect(
        service.update(adminActor, tutorId, {
          lessonDurations: [45],
        }),
      ).rejects.toThrow('Допустимая длительность');
    });
  });
});
