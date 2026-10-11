import { StudentBalanceLedgerService } from './student-balance-ledger.service';
import { StudentBalanceLedgerEntity } from './entities/student-balance-ledger.entity';
import { StudentEntity } from '../students/entities/student.entity';

/**
 * In-memory simulation of ledger.apply + counter — proves idempotency contracts
 * without requiring a live PostgreSQL connection.
 */
describe('StudentBalanceLedgerService (idempotent contracts)', () => {
  type Row = {
    id: string;
    studentId: string;
    delta: number;
    balanceBefore: number;
    balanceAfter: number;
    operationType: string;
    sourceType: string;
    sourceId: string | null;
    idempotencyKey: string;
    description: string | null;
    createdByUserId: string | null;
  };

  function createHarness(initialBalance = 5) {
    const student = { id: 'stu-1', lessonBalance: initialBalance };
    const ledger = new Map<string, Row>();
    let seq = 0;

    const studentRepo = {
      findOne: jest.fn(async () => ({ ...student })),
      save: jest.fn(async (row: { lessonBalance: number }) => {
        student.lessonBalance = row.lessonBalance;
        return row;
      }),
    };

    const ledgerRepo = {
      findOne: jest.fn(async ({ where }: { where: { idempotencyKey: string } }) => {
        return ledger.get(where.idempotencyKey) ?? null;
      }),
      create: jest.fn((row: Row) => row),
      save: jest.fn(async (row: Row) => {
        if (ledger.has(row.idempotencyKey)) {
          const err = new Error('unique') as Error & {
            driverError?: { code: string };
          };
          // Mimic TypeORM QueryFailedError path — service checks instanceof.
          Object.setPrototypeOf(err, require('typeorm').QueryFailedError.prototype);
          (err as { driverError: { code: string } }).driverError = { code: '23505' };
          throw err;
        }
        seq += 1;
        const saved = { ...row, id: `led-${seq}` };
        ledger.set(row.idempotencyKey, saved);
        return saved;
      }),
    };

    const em = {
      getRepository: (entity: unknown) => {
        if (entity === StudentEntity) return studentRepo;
        if (entity === StudentBalanceLedgerEntity) return ledgerRepo;
        throw new Error(`unexpected entity ${String(entity)}`);
      },
    };

    const dataSource = {
      transaction: jest.fn(async (fn: (m: typeof em) => Promise<unknown>) => fn(em)),
      getRepository: em.getRepository,
    };

    const service = new StudentBalanceLedgerService(dataSource as never);
    return { service, student, ledger, em };
  }

  it('CREDIT then same key is a no-op', async () => {
    const { service, student, em } = createHarness(0);
    const first = await service.apply(
      {
        studentId: 'stu-1',
        delta: 5,
        operationType: 'credit',
        sourceType: 'payment',
        sourceId: 'pay-1',
        idempotencyKey: 'payment:pay-1:credit:vapply',
      },
      em as never,
    );
    expect(first.applied).toBe(true);
    expect(student.lessonBalance).toBe(5);

    const second = await service.apply(
      {
        studentId: 'stu-1',
        delta: 5,
        operationType: 'credit',
        sourceType: 'payment',
        sourceId: 'pay-1',
        idempotencyKey: 'payment:pay-1:credit:vapply',
      },
      em as never,
    );
    expect(second.applied).toBe(false);
    expect(student.lessonBalance).toBe(5);
  });

  it('lesson debit then restore then restore again', async () => {
    const { service, student, em } = createHarness(3);
    const lessonId = 'les-1';
    const debitKey = StudentBalanceLedgerService.debitKey(lessonId, 'stu-1');
    const restoreKey = StudentBalanceLedgerService.restoreKey(lessonId, 'stu-1');

    await service.apply(
      {
        studentId: 'stu-1',
        delta: -1,
        operationType: 'debit',
        sourceType: 'lesson',
        sourceId: lessonId,
        idempotencyKey: debitKey,
      },
      em as never,
    );
    expect(student.lessonBalance).toBe(2);

    await service.apply(
      {
        studentId: 'stu-1',
        delta: -1,
        operationType: 'debit',
        sourceType: 'lesson',
        sourceId: lessonId,
        idempotencyKey: debitKey,
      },
      em as never,
    );
    expect(student.lessonBalance).toBe(2);

    await service.apply(
      {
        studentId: 'stu-1',
        delta: 1,
        operationType: 'restore',
        sourceType: 'lesson',
        sourceId: lessonId,
        idempotencyKey: restoreKey,
      },
      em as never,
    );
    expect(student.lessonBalance).toBe(3);

    await service.apply(
      {
        studentId: 'stu-1',
        delta: 1,
        operationType: 'restore',
        sourceType: 'lesson',
        sourceId: lessonId,
        idempotencyKey: restoreKey,
      },
      em as never,
    );
    expect(student.lessonBalance).toBe(3);
  });

  it('payment revise 5→8 then 8→3', async () => {
    const { service, student, em } = createHarness(0);
    await service.apply(
      {
        studentId: 'stu-1',
        delta: 5,
        operationType: 'credit',
        sourceType: 'payment',
        sourceId: 'p1',
        idempotencyKey: StudentBalanceLedgerService.paymentCreditKey('p1', 'apply'),
      },
      em as never,
    );
    await service.apply(
      {
        studentId: 'stu-1',
        delta: 3,
        operationType: 'credit',
        sourceType: 'payment',
        sourceId: 'p1',
        idempotencyKey: StudentBalanceLedgerService.paymentDeltaKey('p1', '5->8'),
      },
      em as never,
    );
    expect(student.lessonBalance).toBe(8);
    await service.apply(
      {
        studentId: 'stu-1',
        delta: -5,
        operationType: 'debit',
        sourceType: 'payment',
        sourceId: 'p1',
        idempotencyKey: StudentBalanceLedgerService.paymentDeltaKey('p1', '8->3'),
      },
      em as never,
    );
    expect(student.lessonBalance).toBe(3);
  });

  it('manual adjustment +2 then -1', async () => {
    const { service, student, em } = createHarness(4);
    await service.apply(
      {
        studentId: 'stu-1',
        delta: 2,
        operationType: 'adjustment',
        sourceType: 'adjustment',
        sourceId: 'adj-1',
        idempotencyKey: StudentBalanceLedgerService.adjustmentKey('adj-1'),
      },
      em as never,
    );
    expect(student.lessonBalance).toBe(6);
    await service.apply(
      {
        studentId: 'stu-1',
        delta: -1,
        operationType: 'adjustment',
        sourceType: 'adjustment',
        sourceId: 'adj-2',
        idempotencyKey: StudentBalanceLedgerService.adjustmentKey('adj-2'),
      },
      em as never,
    );
    expect(student.lessonBalance).toBe(5);
  });

  it('initial balance +1', async () => {
    const { service, student, em } = createHarness(0);
    await service.apply(
      {
        studentId: 'stu-1',
        delta: 1,
        operationType: 'initial',
        sourceType: 'student_create',
        sourceId: 'stu-1',
        idempotencyKey: StudentBalanceLedgerService.initialKey('stu-1'),
      },
      em as never,
    );
    expect(student.lessonBalance).toBe(1);
  });

  it('contact and CRM share the same debit key (no double charge)', async () => {
    const { service, student, em } = createHarness(2);
    const key = StudentBalanceLedgerService.debitKey('les-shared', 'stu-1');
    await service.apply(
      {
        studentId: 'stu-1',
        delta: -1,
        operationType: 'debit',
        sourceType: 'lesson',
        sourceId: 'les-shared',
        idempotencyKey: key,
        description: 'crm',
      },
      em as never,
    );
    const contactPath = await service.apply(
      {
        studentId: 'stu-1',
        delta: -1,
        operationType: 'debit',
        sourceType: 'lesson',
        sourceId: 'les-shared',
        idempotencyKey: key,
        description: 'contact',
      },
      em as never,
    );
    expect(contactPath.applied).toBe(false);
    expect(student.lessonBalance).toBe(1);
  });

  it('student change A→B uses distinct debit/restore keys', () => {
    expect(StudentBalanceLedgerService.debitKey('L', 'A')).not.toBe(
      StudentBalanceLedgerService.debitKey('L', 'B'),
    );
    expect(StudentBalanceLedgerService.restoreKey('L', 'A')).not.toBe(
      StudentBalanceLedgerService.restoreKey('L', 'B'),
    );
    // A→B→A restore/debit keys remain distinct and stable.
    expect(StudentBalanceLedgerService.debitKey('L', 'A')).toBe(
      'lesson:L:student:A:debit',
    );
    expect(StudentBalanceLedgerService.restoreKey('L', 'A')).toBe(
      'lesson:L:student:A:restore',
    );
  });
});
