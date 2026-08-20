import { ForbiddenException } from '@nestjs/common';
import { StudentAccessService } from './student-access.service';

function actor(role: string, sub = 'user-1') {
  return { sub, role } as never;
}

describe('StudentAccessService payment ACL', () => {
  const studentRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const teacherRepo = {
    findOne: jest.fn(),
  };

  const service = new StudentAccessService(
    studentRepo as never,
    teacherRepo as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('admin can write payment for any existing student regardless of assignment', async () => {
    studentRepo.findOne.mockResolvedValue({
      id: 'stu-1',
      assignedTeacherId: 'teacher-other',
    });
    await expect(
      service.assertCanWritePayment(actor('admin'), 'stu-1'),
    ).resolves.toBeUndefined();
  });

  it('teacher can write payment only for assigned students', async () => {
    teacherRepo.findOne.mockResolvedValue({ id: 'teacher-1', userId: 'user-1' });
    studentRepo.findOne.mockResolvedValue({
      id: 'stu-1',
      assignedTeacherId: 'teacher-1',
    });
    await expect(
      service.assertCanWritePayment(actor('teacher'), 'stu-1'),
    ).resolves.toBeUndefined();

    studentRepo.findOne.mockResolvedValue({
      id: 'stu-2',
      assignedTeacherId: 'teacher-other',
    });
    await expect(
      service.assertCanWritePayment(actor('teacher'), 'stu-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes teacher payment list to assigned student ids (not creator)', async () => {
    teacherRepo.findOne.mockResolvedValue({ id: 'teacher-1', userId: 'user-1' });
    studentRepo.find.mockResolvedValue([{ id: 'stu-a' }, { id: 'stu-b' }]);

    const scoped = await service.scopePaymentFilter(actor('teacher'), {});
    const op = scoped.studentId as { _type?: string; _value?: string[]; value?: string[] };
    expect(op._type === 'in' || Array.isArray(op._value) || Array.isArray(op.value)).toBe(true);
    const ids = op._value ?? op.value ?? [];
    expect(ids).toEqual(expect.arrayContaining(['stu-a', 'stu-b']));
  });

  it('listStudentsForPayments: admin sees every student regardless of assignment', async () => {
    studentRepo.find.mockResolvedValue([
      { id: 'a', assignedTeacherId: null, name: 'Аня' },
      { id: 'b', assignedTeacherId: 'teacher-other', name: 'Боря' },
    ]);
    const rows = await service.listStudentsForPayments(actor('admin'));
    expect(rows).toHaveLength(2);
    expect(studentRepo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
  });

  it('listStudentsForPayments: teacher sees only assigned (not by creator)', async () => {
    teacherRepo.findOne.mockResolvedValue({ id: 'teacher-1', userId: 'user-1' });
    studentRepo.find.mockResolvedValue([{ id: 'stu-1', name: 'Аня' }]);
    const rows = await service.listStudentsForPayments(actor('teacher'));
    expect(rows).toHaveLength(1);
    expect(studentRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignedTeacherId: 'teacher-1' }),
        order: { name: 'ASC' },
      }),
    );
  });

  it('keeps tutors forbidden from school payment filters', async () => {
    await expect(
      service.scopePaymentFilter(actor('tutor'), {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.listStudentsForPayments(actor('tutor')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('students cannot write school payments', async () => {
    await expect(
      service.assertCanWritePayment(actor('student'), 'stu-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
