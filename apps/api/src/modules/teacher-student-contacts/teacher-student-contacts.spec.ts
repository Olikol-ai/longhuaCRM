import { TeacherStudentContactsService } from './teacher-student-contacts.service';

describe('TeacherStudentContactsService private notebook', () => {
  const teacherId = 'teacher-1';
  const tutorId = 'tutor-1';
  const teacherActor = {
    sub: 'user-teacher-1',
    email: 'teacher@test.local',
    role: 'teacher' as const,
  };
  const tutorActor = {
    sub: 'user-tutor-1',
    email: 'tutor@test.local',
    role: 'tutor' as const,
  };
  const otherTeacher = {
    sub: 'user-teacher-2',
    email: 'other@test.local',
    role: 'teacher' as const,
  };

  const contactAccess = {
    resolveOwner: jest.fn(),
    assertCanList: jest.fn().mockResolvedValue(undefined),
    assertCanWrite: jest.fn(),
  };

  const contactRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((row: unknown) => row),
    save: jest.fn(async (row: unknown) => row),
  };

  const service = new TeacherStudentContactsService(
    contactRepo as never,
    contactAccess as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    contactAccess.resolveOwner.mockImplementation(async (actor: { role: string }) => {
      if (actor.role === 'tutor') {
        return { ownerType: 'tutor', ownerId: tutorId };
      }
      return { ownerType: 'teacher', ownerId: teacherId };
    });
    contactAccess.assertCanList.mockResolvedValue(undefined);
    contactRepo.create.mockImplementation((row: unknown) => row);
    contactRepo.save.mockImplementation(async (row: unknown) => row);
  });

  it('teacher creates contact without User / linked Student', async () => {
    const row = await service.create(teacherActor, {
      name: 'Иванов Иван',
      phone: '+375291112233',
      comment: 'личный список',
    });

    expect(contactAccess.resolveOwner).toHaveBeenCalled();
    expect(contactRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: 'teacher',
        ownerId: teacherId,
        name: 'Иванов Иван',
        phone: '+375291112233',
        comment: 'личный список',
        linkedStudentId: null,
        status: 'active',
      }),
    );
    expect(row.linkedStudentId).toBeNull();
    expect((row as { userId?: unknown }).userId).toBeUndefined();
  });

  it('tutor can create contact under tutor owner', async () => {
    const row = await service.create(
      tutorActor,
      { name: 'Пупкин' },
      'tutor',
    );

    expect(contactRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: 'tutor',
        ownerId: tutorId,
        name: 'Пупкин',
        linkedStudentId: null,
      }),
    );
    expect(row.linkedStudentId).toBeNull();
  });

  it('forbids listing another owner contacts', async () => {
    contactAccess.assertCanList.mockRejectedValue(
      Object.assign(new Error('Можно видеть только своих учеников'), {
        status: 403,
      }),
    );

    await expect(
      service.listForOwner(otherTeacher, 'teacher', 'someone-else'),
    ).rejects.toThrow(/своих учеников/);
  });

  it('soft-deletes contact as inactive', async () => {
    const existing = {
      id: 'c-1',
      ownerType: 'teacher',
      ownerId: teacherId,
      name: 'Иванов',
      status: 'active',
    };
    contactAccess.assertCanWrite.mockResolvedValue(existing);

    const result = await service.remove(teacherActor, 'c-1');

    expect(contactRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c-1', status: 'inactive' }),
    );
    expect(result).toEqual({ id: 'c-1', deleted: true });
  });
});
