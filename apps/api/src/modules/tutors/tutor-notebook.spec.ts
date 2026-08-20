import { TutorsService } from './tutors.service';

describe('TutorsService private notebook', () => {
  const tutorId = 'tutor-1';
  const actor = {
    sub: 'user-tutor-1',
    email: 'tutor@test.local',
    role: 'tutor' as const,
  };

  const tutorAccess = {
    resolveTutorId: jest.fn().mockResolvedValue(tutorId),
    assertCanReadTutor: jest.fn(),
    scopeTutorFilter: jest.fn(),
  };

  const tutorStudentAccess = {
    assertCanListForTutor: jest.fn().mockResolvedValue(undefined),
    assertCanWriteTutorStudent: jest.fn(),
    assertCanReadTutorStudent: jest.fn(),
  };

  const tutorStudentRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((row: unknown) => row),
    save: jest.fn(async (row: unknown) => row),
  };

  const lessonRepo = {
    find: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ affected: 0 }),
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
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tutorAccess.resolveTutorId.mockResolvedValue(tutorId);
    tutorStudentAccess.assertCanListForTutor.mockResolvedValue(undefined);
    tutorStudentRepo.create.mockImplementation((row: unknown) => row);
    tutorStudentRepo.save.mockImplementation(async (row: unknown) => row);
  });

  it('creates notebook entry without userId / school student linkage', async () => {
    const row = await service.createNotebookStudent(actor, {
      name: 'Пупкин Залупкин',
      phone: '+375291112233',
      comment: 'личный блокнот',
    });

    expect(tutorStudentAccess.assertCanListForTutor).toHaveBeenCalledWith(actor, tutorId);
    expect(tutorStudentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tutorId,
        userId: null,
        email: null,
        phone: '+375291112233',
        notes: 'личный блокнот',
        inviteLinkId: null,
        status: 'active',
      }),
    );
    expect(row.userId).toBeNull();
    expect(String(row.name)).toContain('Пупкин');
  });

  it('soft-deletes notebook entry as inactive', async () => {
    const existing = {
      id: 'ts-1',
      tutorId,
      name: 'Пупкин',
      status: 'active',
    };
    tutorStudentAccess.assertCanWriteTutorStudent.mockResolvedValue(existing);

    const result = await service.deleteNotebookStudent(actor, 'ts-1');

    expect(tutorStudentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ts-1', status: 'inactive' }),
    );
    expect(result).toEqual({
      id: 'ts-1',
      deleted: true,
      archived: true,
      cancelledLessons: 0,
    });
  });

  it('updates notebook name and comment', async () => {
    const existing = {
      id: 'ts-2',
      tutorId,
      name: 'Old',
      firstName: null,
      lastName: null,
      phone: null,
      notes: null,
      status: 'active',
    };
    tutorStudentAccess.assertCanWriteTutorStudent.mockResolvedValue(existing);

    await service.updateNotebookStudent(actor, 'ts-2', {
      name: 'Новый Ученик',
      comment: 'обновлено',
    });

    expect(tutorStudentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ts-2',
        notes: 'обновлено',
      }),
    );
    expect(String(existing.name)).toContain('Новый');
  });
});
