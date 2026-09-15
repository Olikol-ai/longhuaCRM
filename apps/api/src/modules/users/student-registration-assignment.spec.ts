import { RoleEntitySyncService } from './role-entity-sync.service';

describe('RoleEntitySyncService student registration teacher assignment', () => {
  const studentRepo = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (row: unknown) => row),
    create: jest.fn((row: unknown) => row),
    update: jest.fn(),
  };
  const teacherRepo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), update: jest.fn() };
  const tutorRepo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), update: jest.fn() };
  const tutorStudentRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
  };
  const userRepo = { findOne: jest.fn(), save: jest.fn() };
  const materialAccessRepo = { update: jest.fn().mockResolvedValue({ affected: 0 }) };
  const salesCommissions = { ensureProfile: jest.fn().mockResolvedValue(undefined) };

  const service = new RoleEntitySyncService(
    studentRepo as never,
    teacherRepo as never,
    tutorRepo as never,
    tutorStudentRepo as never,
    userRepo as never,
    materialAccessRepo as never,
    salesCommissions as never,
  );

  const user = {
    id: 'user-1',
    email: 'student@test.local',
    firstName: 'Иван',
    lastName: 'Иванов',
    phone: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    teacherRepo.findOne.mockResolvedValue(null);
    tutorRepo.findOne.mockResolvedValue(null);
    tutorStudentRepo.findOne.mockResolvedValue(null);
    tutorStudentRepo.find.mockResolvedValue([]);
  });

  it('scenario 1: registration without ref creates student with teacher_id = null', async () => {
    studentRepo.findOne.mockResolvedValue(null);

    await service.syncAfterRoleChange(user, 'student', undefined, {
      assignedTeacherId: null,
    });

    expect(studentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        email: 'student@test.local',
        assignedTeacherId: null,
        status: 'pending_assignment',
      }),
    );
    expect(studentRepo.save).toHaveBeenCalled();
  });

  it('scenario 2: registration with ref assigns that teacher only', async () => {
    studentRepo.findOne.mockResolvedValue(null);

    await service.syncAfterRoleChange(user, 'student', undefined, {
      assignedTeacherId: 'teacher-maria-id',
    });

    expect(studentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedTeacherId: 'teacher-maria-id',
        status: 'active',
      }),
    );
  });

  it('scenario 3: no ref does not inherit orphan student teacher even if teachers exist', async () => {
    studentRepo.findOne
      .mockResolvedValueOnce(null) // by userId
      .mockResolvedValueOnce({
        id: 'orphan-student',
        userId: null,
        email: 'student@test.local',
        assignedTeacherId: 'teacher-maria-id',
        status: 'active',
        firstName: 'Иван',
        lastName: 'Иванов',
        name: 'Иванов Иван',
      });

    await service.syncAfterRoleChange(user, 'student', undefined, {
      assignedTeacherId: null,
    });

    expect(studentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        assignedTeacherId: null,
        status: 'pending_assignment',
      }),
    );
    expect(studentRepo.create).not.toHaveBeenCalled();
  });

  it('does not pick a default teacher when options omit assignedTeacherId', async () => {
    studentRepo.findOne.mockResolvedValue(null);

    await service.syncAfterRoleChange(user, 'student');

    expect(studentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedTeacherId: null,
        status: 'pending_assignment',
      }),
    );
  });

  it('invite registration links orphan student by teacher + phone (not name)', async () => {
    const phoneUser = {
      ...user,
      email: 'new-account@test.local',
      phone: '+375 29 111-22-33',
    };
    studentRepo.findOne
      .mockResolvedValueOnce(null) // by userId
      .mockResolvedValueOnce(null); // by email
    studentRepo.find.mockResolvedValueOnce([
      {
        id: 'orphan-phone',
        userId: null,
        email: null,
        phone: '375291112233',
        assignedTeacherId: 'teacher-maria-id',
        status: 'active',
        mergedIntoStudentId: null,
        firstName: 'Иван',
        lastName: 'Иванов',
        name: 'Иванов Иван',
      },
      {
        id: 'orphan-other-phone',
        userId: null,
        email: null,
        phone: '375299999999',
        assignedTeacherId: 'teacher-maria-id',
        status: 'active',
        mergedIntoStudentId: null,
        name: 'Иванов Иван',
      },
    ]);

    await service.syncAfterRoleChange(phoneUser, 'student', undefined, {
      assignedTeacherId: 'teacher-maria-id',
    });

    expect(studentRepo.create).not.toHaveBeenCalled();
    expect(studentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'orphan-phone',
        userId: 'user-1',
        email: 'new-account@test.local',
        phone: '+375 29 111-22-33',
        assignedTeacherId: 'teacher-maria-id',
        status: 'active',
      }),
    );
  });

  it('does not merge orphan by matching name alone', async () => {
    const phoneUser = {
      ...user,
      email: 'another@test.local',
      phone: '+375291000000',
    };
    studentRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    studentRepo.find.mockResolvedValueOnce([
      {
        id: 'orphan-same-name',
        userId: null,
        email: null,
        phone: null,
        assignedTeacherId: 'teacher-maria-id',
        status: 'active',
        mergedIntoStudentId: null,
        name: 'Иванов Иван',
      },
    ]);

    await service.syncAfterRoleChange(phoneUser, 'student', undefined, {
      assignedTeacherId: 'teacher-maria-id',
    });

    expect(studentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        assignedTeacherId: 'teacher-maria-id',
        phone: '+375291000000',
      }),
    );
  });
});
