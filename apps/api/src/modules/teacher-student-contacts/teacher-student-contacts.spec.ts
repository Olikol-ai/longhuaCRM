import { TeacherStudentContactsService } from './teacher-student-contacts.service';
import { TeacherStudentContactBalanceService } from './teacher-student-contact-balance.service';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherStudentContactEntity } from './entities/teacher-student-contact.entity';

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

  const historyRepo = {
    find: jest.fn().mockResolvedValue([]),
  };

  const dataSource = {
    getRepository: jest.fn().mockReturnValue({
      find: jest.fn().mockResolvedValue([]),
    }),
    transaction: jest.fn(async (fn: (m: unknown) => unknown) =>
      fn({
        getRepository: () => contactRepo,
      }),
    ),
  };

  const balanceService = {
    applyManualBalance: jest.fn(
      async (_em: unknown, contact: { lessonBalance?: number }, newBalance: number) => {
        contact.lessonBalance = newBalance;
        return contact;
      },
    ),
    ensureTutorBalanceRow: jest.fn(async () => undefined),
  };

  const service = new TeacherStudentContactsService(
    contactRepo as never,
    historyRepo as never,
    dataSource as never,
    contactAccess as never,
    balanceService as never,
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
    dataSource.getRepository.mockReturnValue({
      find: jest.fn().mockResolvedValue([]),
    });
  });

  it('teacher creates contact linked to school Student for admin visibility', async () => {
    const studentRepo = {
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: { id: string }) => ({ ...row, id: 'stu-linked-1' })),
    };
    dataSource.transaction.mockImplementation(async (fn: (m: unknown) => unknown) =>
      fn({
        getRepository: (entity: unknown) => {
          if (entity === StudentEntity) {
            return studentRepo;
          }
          return contactRepo;
        },
      }),
    );

    const row = await service.create(teacherActor, {
      name: 'Иванов Иван',
      phone: '+375291112233',
      comment: 'личный список',
    });

    expect(contactAccess.resolveOwner).toHaveBeenCalled();
    expect(studentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Иванов Иван',
        phone: '+375291112233',
        assignedTeacherId: teacherId,
        status: 'active',
      }),
    );
    expect(contactRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: 'teacher',
        ownerId: teacherId,
        name: 'Иванов Иван',
        linkedStudentId: 'stu-linked-1',
        status: 'active',
      }),
    );
    expect(contactRepo.create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        lessonBalance: expect.anything(),
      }),
    );
    expect(row.linkedStudentId).toBe('stu-linked-1');
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
    expect(balanceService.ensureTutorBalanceRow).toHaveBeenCalled();
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

  it('soft-archives contact as inactive and cancels planned lessons', async () => {
    const existing = {
      id: 'c-1',
      ownerType: 'teacher',
      ownerId: teacherId,
      name: 'Иванов',
      status: 'active',
      linkedStudentId: null,
    };
    contactAccess.assertCanWrite.mockResolvedValue(existing);

    const lessonRepo = {
      find: jest.fn().mockResolvedValue([{ id: 'l-1' }, { id: 'l-2' }]),
      update: jest.fn().mockResolvedValue({ affected: 2 }),
    };
    dataSource.transaction.mockImplementation(async (fn: (m: unknown) => unknown) => {
      const repos = [contactRepo, lessonRepo];
      let i = 0;
      return fn({
        getRepository: () => repos[Math.min(i++, repos.length - 1)],
      });
    });

    const result = await service.remove(teacherActor, 'c-1');

    expect(contactRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c-1', status: 'inactive' }),
    );
    expect(lessonRepo.find).toHaveBeenCalled();
    expect(lessonRepo.update).toHaveBeenCalled();
    expect(result).toEqual({
      id: 'c-1',
      deleted: true,
      archived: true,
      cancelledLessons: 2,
    });
  });

  it('updates balance via balance service', async () => {
    const existing = {
      id: 'c-2',
      ownerType: 'teacher',
      ownerId: teacherId,
      name: 'Иванов',
      status: 'active',
      lessonBalance: 10,
    };
    contactAccess.assertCanWrite.mockResolvedValue(existing);
    contactRepo.findOne.mockResolvedValue({ ...existing });
    dataSource.transaction.mockImplementation(async (fn: (m: unknown) => unknown) =>
      fn({
        getRepository: () => ({
          findOne: jest.fn().mockResolvedValue({ ...existing }),
        }),
      }),
    );

    await service.updateBalance(teacherActor, 'c-2', {
      newBalance: 15,
      reason: 'оплата',
    });

    expect(balanceService.applyManualBalance).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'c-2' }),
      15,
      'оплата',
      teacherActor.sub,
    );
  });
});

describe('TeacherStudentContactBalanceService', () => {
  it('deducts tutor balance once and skips when already deducted', async () => {
    const contact = { id: 'c-1', ownerType: 'tutor', linkedStudentId: null };
    const tutorBalance = { contactId: 'c-1', lessonBalance: 10 };
    const attendance = {
      id: 'a-1',
      balanceDeducted: false,
      teacherStudentContactId: 'c-1',
    };

    const attendanceRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ ...attendance })
        .mockResolvedValueOnce({ ...attendance, balanceDeducted: true }),
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: unknown) => row),
      update: jest
        .fn()
        .mockResolvedValueOnce({ affected: 1 })
        .mockResolvedValueOnce({ affected: 0 }),
    };
    const contactRepo = {
      findOne: jest.fn().mockResolvedValue(contact),
      save: jest.fn(async (row: unknown) => row),
    };
    const tutorBalanceRepo = {
      findOne: jest.fn().mockResolvedValue(tutorBalance),
      save: jest.fn(async (row: unknown) => row),
      create: jest.fn((row: unknown) => row),
    };
    const historyRepo = {
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: unknown) => row),
    };
    const lessonRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'l-1',
        primaryTeacherStudentContactId: 'c-1',
      }),
    };

    const service = new TeacherStudentContactBalanceService({
      transaction: jest.fn(),
    } as never);

    const { AttendanceEntity } = await import('../lessons/entities/attendance.entity');
    const { LessonEntity } = await import('../lessons/entities/lesson.entity');
    const { TeacherStudentContactEntity } = await import(
      './entities/teacher-student-contact.entity'
    );
    const { TeacherStudentBalanceHistoryEntity } = await import(
      './entities/teacher-student-balance-history.entity'
    );
    const { TutorContactBalanceEntity } = await import(
      './entities/tutor-contact-balance.entity'
    );

    const typedManager = {
      getRepository: (entity: unknown) => {
        if (entity === AttendanceEntity) return attendanceRepo;
        if (entity === LessonEntity) return lessonRepo;
        if (entity === TeacherStudentContactEntity) return contactRepo;
        if (entity === TeacherStudentBalanceHistoryEntity) return historyRepo;
        if (entity === TutorContactBalanceEntity) return tutorBalanceRepo;
        return lessonRepo;
      },
    };

    await service.deductForCompletedLesson('l-1', typedManager as never);
    expect(tutorBalance.lessonBalance).toBe(9);
    expect(historyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        oldBalance: 10,
        newBalance: 9,
        changeAmount: -1,
      }),
    );

    await service.deductForCompletedLesson('l-1', typedManager as never);
    expect(tutorBalance.lessonBalance).toBe(9);
  });

  it('restores tutor balance when cancelling completed contact lesson', async () => {
    const contact = { id: 'c-1', ownerType: 'tutor', linkedStudentId: null };
    const tutorBalance = { contactId: 'c-1', lessonBalance: 9 };
    const attendance = {
      id: 'a-1',
      balanceDeducted: true,
      teacherStudentContactId: 'c-1',
    };
    const attendanceRepo = {
      findOne: jest.fn().mockResolvedValue(attendance),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const contactRepo = {
      findOne: jest.fn().mockResolvedValue(contact),
      save: jest.fn(async (row: unknown) => row),
    };
    const tutorBalanceRepo = {
      findOne: jest.fn().mockResolvedValue(tutorBalance),
      save: jest.fn(async (row: unknown) => row),
      create: jest.fn((row: unknown) => row),
    };
    const historyRepo = {
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: unknown) => row),
    };
    const lessonRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'l-1',
        primaryTeacherStudentContactId: 'c-1',
      }),
    };

    const { AttendanceEntity } = await import('../lessons/entities/attendance.entity');
    const { LessonEntity } = await import('../lessons/entities/lesson.entity');
    const { TeacherStudentContactEntity } = await import(
      './entities/teacher-student-contact.entity'
    );
    const { TeacherStudentBalanceHistoryEntity } = await import(
      './entities/teacher-student-balance-history.entity'
    );
    const { TutorContactBalanceEntity } = await import(
      './entities/tutor-contact-balance.entity'
    );

    const typedManager = {
      getRepository: (entity: unknown) => {
        if (entity === AttendanceEntity) return attendanceRepo;
        if (entity === LessonEntity) return lessonRepo;
        if (entity === TeacherStudentContactEntity) return contactRepo;
        if (entity === TeacherStudentBalanceHistoryEntity) return historyRepo;
        if (entity === TutorContactBalanceEntity) return tutorBalanceRepo;
        return lessonRepo;
      },
    };

    const service = new TeacherStudentContactBalanceService({
      transaction: jest.fn(),
    } as never);

    await service.restoreForCancelledLesson('l-1', typedManager as never);
    expect(tutorBalance.lessonBalance).toBe(10);
    expect(historyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        oldBalance: 9,
        newBalance: 10,
        changeAmount: 1,
      }),
    );
  });

  it('does not deduct when lesson has no private contact', async () => {
    const lessonRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'l-crm',
        primaryTeacherStudentContactId: null,
        primaryStudentId: 's-1',
      }),
    };
    const attendanceRepo = { findOne: jest.fn(), update: jest.fn() };
    const { LessonEntity } = await import('../lessons/entities/lesson.entity');
    const { AttendanceEntity } = await import('../lessons/entities/attendance.entity');
    const typedManager = {
      getRepository: (entity: unknown) => {
        if (entity === LessonEntity) return lessonRepo;
        if (entity === AttendanceEntity) return attendanceRepo;
        return lessonRepo;
      },
    };
    const service = new TeacherStudentContactBalanceService({
      transaction: jest.fn(),
    } as never);
    await service.deductForCompletedLesson('l-crm', typedManager as never);
    expect(attendanceRepo.findOne).not.toHaveBeenCalled();
  });

  it('applyManualBalance for teacher writes Student only (no contact balance)', async () => {
    const student = { id: 's-1', lessonBalance: 1 };
    const contact = {
      id: 'c-1',
      ownerType: 'teacher',
      linkedStudentId: 's-1',
    };
    const contactRepo = {
      save: jest.fn(async (row: unknown) => row),
    };
    const studentRepo = {
      findOne: jest.fn().mockResolvedValue(student),
      save: jest.fn(async (row: unknown) => row),
    };
    const historyRepo = {
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: unknown) => row),
    };
    const { TeacherStudentContactEntity } = await import(
      './entities/teacher-student-contact.entity'
    );
    const { StudentEntity } = await import('../students/entities/student.entity');
    const { TeacherStudentBalanceHistoryEntity } = await import(
      './entities/teacher-student-balance-history.entity'
    );
    const typedManager = {
      getRepository: (entity: unknown) => {
        if (entity === TeacherStudentContactEntity) return contactRepo;
        if (entity === StudentEntity) return studentRepo;
        if (entity === TeacherStudentBalanceHistoryEntity) return historyRepo;
        return contactRepo;
      },
    };
    const service = new TeacherStudentContactBalanceService({
      transaction: jest.fn(),
    } as never);

    await service.applyManualBalance(typedManager as never, contact as never, 0, 'zero', 'u-1');
    expect(student.lessonBalance).toBe(0);
    expect(contactRepo.save).not.toHaveBeenCalled();
    expect(historyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ oldBalance: 1, newBalance: 0, changeAmount: -1 }),
    );
  });

  it('applyManualBalance for tutor writes tutor_contact_balances only', async () => {
    const contact = {
      id: 'c-tutor',
      ownerType: 'tutor',
      linkedStudentId: null,
    };
    const tutorBalance = { contactId: 'c-tutor', lessonBalance: 3 };
    const contactRepo = {
      save: jest.fn(async (row: unknown) => row),
    };
    const tutorBalanceRepo = {
      findOne: jest.fn().mockResolvedValue(tutorBalance),
      save: jest.fn(async (row: unknown) => row),
      create: jest.fn((row: unknown) => row),
    };
    const studentRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const historyRepo = {
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: unknown) => row),
    };
    const { TeacherStudentContactEntity } = await import(
      './entities/teacher-student-contact.entity'
    );
    const { StudentEntity } = await import('../students/entities/student.entity');
    const { TeacherStudentBalanceHistoryEntity } = await import(
      './entities/teacher-student-balance-history.entity'
    );
    const { TutorContactBalanceEntity } = await import(
      './entities/tutor-contact-balance.entity'
    );
    const typedManager = {
      getRepository: (entity: unknown) => {
        if (entity === TeacherStudentContactEntity) return contactRepo;
        if (entity === StudentEntity) return studentRepo;
        if (entity === TeacherStudentBalanceHistoryEntity) return historyRepo;
        if (entity === TutorContactBalanceEntity) return tutorBalanceRepo;
        return contactRepo;
      },
    };
    const service = new TeacherStudentContactBalanceService({
      transaction: jest.fn(),
    } as never);

    await service.applyManualBalance(typedManager as never, contact as never, 2, 'adj', 'u-1');
    expect(tutorBalance.lessonBalance).toBe(2);
    expect(tutorBalanceRepo.save).toHaveBeenCalled();
    expect(contactRepo.save).not.toHaveBeenCalled();
    expect(studentRepo.findOne).not.toHaveBeenCalled();
  });

  it('applyManualBalance allows negative debt on Student', async () => {
    const student = { id: 's-1', lessonBalance: 0 };
    const contact = {
      id: 'c-1',
      ownerType: 'teacher',
      linkedStudentId: 's-1',
    };
    const contactRepo = {
      save: jest.fn(async (row: unknown) => row),
    };
    const studentRepo = {
      findOne: jest.fn().mockResolvedValue(student),
      save: jest.fn(async (row: unknown) => row),
    };
    const historyRepo = {
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: unknown) => row),
    };
    const { TeacherStudentContactEntity } = await import(
      './entities/teacher-student-contact.entity'
    );
    const { StudentEntity } = await import('../students/entities/student.entity');
    const { TeacherStudentBalanceHistoryEntity } = await import(
      './entities/teacher-student-balance-history.entity'
    );
    const typedManager = {
      getRepository: (entity: unknown) => {
        if (entity === TeacherStudentContactEntity) return contactRepo;
        if (entity === StudentEntity) return studentRepo;
        if (entity === TeacherStudentBalanceHistoryEntity) return historyRepo;
        return contactRepo;
      },
    };
    const service = new TeacherStudentContactBalanceService({
      transaction: jest.fn(),
    } as never);

    await service.applyManualBalance(typedManager as never, contact as never, -2, 'debt', 'u-1');
    expect(student.lessonBalance).toBe(-2);
    expect(historyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ oldBalance: 0, newBalance: -2, changeAmount: -2 }),
    );
  });
});
