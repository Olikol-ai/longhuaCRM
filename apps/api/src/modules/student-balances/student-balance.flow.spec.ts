import { StudentBalanceService } from '../students/student-balance.service';
import { StudentBalanceLedgerService } from './student-balance-ledger.service';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { GroupMemberEntity } from '../groups/entities/group-member.entity';

describe('StudentBalanceService lesson debit/restore flow', () => {
  function buildService(opts: {
    lesson: Record<string, unknown>;
    attendance?: Record<string, unknown> | null;
    members?: Array<{ studentId: string }>;
  }) {
    const ledgerCalls: Array<Record<string, unknown>> = [];
    const ledger = {
      apply: jest.fn(async (input: Record<string, unknown>) => {
        ledgerCalls.push(input);
        return {
          applied: true,
          balanceBefore: 5,
          balanceAfter: 5 + Number(input.delta),
          entry: {},
        };
      }),
      findByIdempotencyKey: jest.fn(async () => null),
    };

    const attendanceState = opts.attendance
      ? { ...opts.attendance }
      : null;

    const attendanceRepo = {
      findOne: jest.fn(async () => attendanceState),
      find: jest.fn(async () => (attendanceState ? [attendanceState] : [])),
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: Record<string, unknown>) => {
        Object.assign(attendanceState ?? {}, row);
        return row;
      }),
      update: jest.fn(async (where: { balanceDeducted?: boolean }, patch: { balanceDeducted: boolean }) => {
        if (attendanceState && attendanceState.balanceDeducted === where.balanceDeducted) {
          attendanceState.balanceDeducted = patch.balanceDeducted;
          return { affected: 1 };
        }
        return { affected: 0 };
      }),
    };

    const lessonRepo = {
      findOne: jest.fn(async () => opts.lesson),
    };
    const groupRepo = {
      find: jest.fn(async () => opts.members ?? []),
    };

    const em = {
      getRepository: (entity: unknown) => {
        if (entity === LessonEntity) return lessonRepo;
        if (entity === AttendanceEntity) return attendanceRepo;
        if (entity === GroupMemberEntity) return groupRepo;
        return lessonRepo;
      },
      query: jest.fn(async () => []),
    };

    const audit = { log: jest.fn(async () => undefined) };
    const dataSource = {
      transaction: jest.fn(async (fn: (m: typeof em) => Promise<unknown>) => fn(em)),
    };

    const service = new StudentBalanceService(
      dataSource as never,
      audit as never,
      ledger as never,
    );

    return { service, ledger, ledgerCalls, attendanceState, em, attendanceRepo };
  }

  it('planned→completed deducts once; second completed is idempotent', async () => {
    const attendance = {
      id: 'a1',
      lessonId: 'L1',
      studentId: 'S1',
      balanceDeducted: false,
    };
    const { service, ledger, em, attendanceState } = buildService({
      lesson: {
        id: 'L1',
        lessonType: 'individual',
        groupId: null,
        primaryStudentId: 'S1',
      },
      attendance,
    });

    await service.handleLessonStatusUpdate('L1', 'completed', em as never);
    expect(ledger.apply).toHaveBeenCalledTimes(1);
    expect(ledger.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        delta: -1,
        idempotencyKey: StudentBalanceLedgerService.debitKey('L1', 'S1'),
      }),
      em,
    );
    expect(attendanceState?.balanceDeducted).toBe(true);

    await service.handleLessonStatusUpdate('L1', 'completed', em as never);
    // Second call still may call apply for catch-up, but same idempotency key.
    const keys = (ledger.apply as jest.Mock).mock.calls.map(
      (c: unknown[]) => (c[0] as { idempotencyKey: string }).idempotencyKey,
    );
    expect(keys.every((k: string) => k === StudentBalanceLedgerService.debitKey('L1', 'S1'))).toBe(
      true,
    );
  });

  it('missed does not debit; missed_no_notice does', async () => {
    const { service, ledger, em } = buildService({
      lesson: {
        id: 'L2',
        lessonType: 'individual',
        groupId: null,
        primaryStudentId: 'S1',
      },
      attendance: {
        id: 'a2',
        lessonId: 'L2',
        studentId: 'S1',
        balanceDeducted: false,
      },
    });
    await service.handleLessonStatusUpdate('L2', 'missed', em as never);
    expect(ledger.apply).not.toHaveBeenCalled();

    await service.handleLessonStatusUpdate('L2', 'missed_no_notice', em as never);
    expect(ledger.apply).toHaveBeenCalledWith(
      expect.objectContaining({ delta: -1 }),
      em,
    );
  });

  it('planned/cancelled/rescheduled never debit', async () => {
    const { service, ledger, em } = buildService({
      lesson: {
        id: 'L0',
        lessonType: 'individual',
        groupId: null,
        primaryStudentId: 'S1',
      },
      attendance: {
        id: 'a0',
        lessonId: 'L0',
        studentId: 'S1',
        balanceDeducted: false,
      },
    });
    for (const status of ['planned', 'cancelled', 'rescheduled'] as const) {
      await service.handleLessonStatusUpdate('L0', status, em as never);
    }
    expect(ledger.apply).not.toHaveBeenCalled();
  });

  it('completed → restore on delete path', async () => {
    const attendance = {
      id: 'a3',
      lessonId: 'L3',
      studentId: 'S1',
      balanceDeducted: true,
    };
    const { service, ledger, em } = buildService({
      lesson: {
        id: 'L3',
        lessonType: 'individual',
        groupId: null,
        primaryStudentId: 'S1',
      },
      attendance,
    });
    (ledger.findByIdempotencyKey as jest.Mock).mockResolvedValue({ id: 'd1' });

    const ok = await service.restoreBalanceForReassignment('L3', 'S1', em as never);
    expect(ok).toBe(true);
    expect(ledger.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        delta: 1,
        operationType: 'restore',
        idempotencyKey: StudentBalanceLedgerService.restoreKey('L3', 'S1'),
      }),
      em,
    );

    await service.restoreBalanceForReassignment('L3', 'S1', em as never);
    const restoreCalls = (ledger.apply as jest.Mock).mock.calls.filter(
      (c: unknown[]) => (c[0] as { operationType: string }).operationType === 'restore',
    );
    expect(restoreCalls.length).toBeGreaterThanOrEqual(1);
    expect(
      restoreCalls.every(
        (c: unknown[]) =>
          (c[0] as { idempotencyKey: string }).idempotencyKey ===
          StudentBalanceLedgerService.restoreKey('L3', 'S1'),
      ),
    ).toBe(true);
  });

  it('group completed debits each member once', async () => {
    const { service, ledger, em } = buildService({
      lesson: {
        id: 'LG',
        lessonType: 'group',
        groupId: 'G1',
        primaryStudentId: null,
      },
      attendance: null,
      members: [{ studentId: 'S1' }, { studentId: 'S2' }],
    });

    // findOne returns null → create attendance per student
    const attendanceRepo = em.getRepository(AttendanceEntity) as {
      findOne: jest.Mock;
      save: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    let created = 0;
    attendanceRepo.findOne.mockImplementation(async () => null);
    attendanceRepo.save.mockImplementation(async (row: Record<string, unknown>) => {
      created += 1;
      return { id: `a-${created}`, balanceDeducted: false, ...row };
    });
    attendanceRepo.update.mockResolvedValue({ affected: 1 });

    await service.handleLessonStatusUpdate('LG', 'completed', em as never);
    expect(ledger.apply).toHaveBeenCalledTimes(2);
    const keys = (ledger.apply as jest.Mock).mock.calls.map(
      (c: unknown[]) => (c[0] as { idempotencyKey: string }).idempotencyKey,
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        StudentBalanceLedgerService.debitKey('LG', 'S1'),
        StudentBalanceLedgerService.debitKey('LG', 'S2'),
      ]),
    );
  });
});
