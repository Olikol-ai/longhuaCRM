import { TeacherInvitesService } from './teacher-invites.service';
import { RoleEntitySyncService } from '../users/role-entity-sync.service';

describe('Teacher referral student counts', () => {
  const teacherId = 'teacher-maria';
  const userId = 'user-ivan';

  describe('TeacherInvitesService.countActiveReferralStudents', () => {
    const inviteRepo = {
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn((row: unknown) => row),
      findOne: jest.fn(),
      increment: jest.fn(),
    };
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn(),
    };
    const studentRepo = {
      createQueryBuilder: jest.fn(() => qb),
    };
    const teacherAccess = {
      resolveTeacherId: jest.fn().mockResolvedValue(teacherId),
    };

    const service = new TeacherInvitesService(
      inviteRepo as never,
      studentRepo as never,
      teacherAccess as never,
    );

    beforeEach(() => {
      jest.clearAllMocks();
      studentRepo.createQueryBuilder.mockReturnValue(qb);
      qb.innerJoin.mockReturnThis();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
    });

    it('counts only linked users with role student', async () => {
      qb.getCount.mockResolvedValue(1);
      await expect(service.countActiveReferralStudents(teacherId)).resolves.toBe(1);
      expect(studentRepo.createQueryBuilder).toHaveBeenCalledWith('s');
      expect(qb.innerJoin).toHaveBeenCalledWith('users', 'u', 'u.id = s.user_id');
      expect(qb.where).toHaveBeenCalledWith('s.assigned_teacher_id = :teacherId', {
        teacherId,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('u.role = :role', { role: 'student' });
    });

    it('listMine exposes live useCount (active students), keeps registrationCount historical', async () => {
      qb.getCount.mockResolvedValue(7);
      inviteRepo.find.mockResolvedValue([
        {
          id: 'inv-1',
          teacherId,
          useCount: 8,
          expiresAt: new Date(Date.now() + 86400000),
          revokedAt: null,
        },
      ]);

      const rows = await service.listMine({
        sub: 'teacher-user',
        email: 't@test.local',
        role: 'teacher',
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].useCount).toBe(7);
      expect(rows[0].activeStudentsCount).toBe(7);
      expect((rows[0] as { registrationCount?: number }).registrationCount).toBe(8);
    });
  });

  describe('role change student ↔ tutor updates eligibility for counts', () => {
    const studentRepo = {
      findOne: jest.fn(),
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

    const sync = new RoleEntitySyncService(
      studentRepo as never,
      teacherRepo as never,
      tutorRepo as never,
      tutorStudentRepo as never,
      userRepo as never,
    );

    const user = {
      id: userId,
      email: 'ivan@test.local',
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
      studentRepo.save.mockImplementation(async (row: unknown) => row);
      tutorRepo.save.mockImplementation(async (row: unknown) => row);
      tutorRepo.create.mockImplementation((row: unknown) => row);
    });

    it('1) referral registration keeps assigned teacher (count-eligible while student)', async () => {
      studentRepo.findOne.mockResolvedValue(null);

      await sync.syncAfterRoleChange(user, 'student', undefined, {
        assignedTeacherId: teacherId,
      });

      expect(studentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          assignedTeacherId: teacherId,
          status: 'active',
        }),
      );
    });

    it('2) student → tutor detaches student user link but keeps assignedTeacherId history', async () => {
      studentRepo.findOne.mockResolvedValue({
        id: 'stu-1',
        userId,
        assignedTeacherId: teacherId,
        status: 'active',
      });
      tutorRepo.findOne.mockResolvedValue(null);

      await sync.syncAfterRoleChange(user, 'tutor');

      expect(studentRepo.update).toHaveBeenCalledWith(
        { userId },
        { userId: null, status: 'inactive' },
      );
      expect(tutorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId, status: 'active' }),
      );
    });

    it('3) tutor → student restores link and reactivates referral assignment', async () => {
      // After detach: orphan student by email, inactive, teacher preserved.
      studentRepo.findOne
        .mockResolvedValueOnce(null) // by userId
        .mockResolvedValueOnce({
          id: 'stu-1',
          userId: null,
          email: 'ivan@test.local',
          assignedTeacherId: teacherId,
          status: 'inactive',
          firstName: 'Иван',
          lastName: 'Иванов',
        });
      tutorRepo.findOne.mockResolvedValue({ id: 'tutor-1', userId });

      await sync.syncAfterRoleChange(user, 'student');

      expect(studentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'stu-1',
          userId,
          assignedTeacherId: teacherId,
          status: 'active',
        }),
      );
      expect(tutorRepo.update).toHaveBeenCalledWith(
        { userId },
        { userId: null, status: 'inactive' },
      );
    });
  });
});
