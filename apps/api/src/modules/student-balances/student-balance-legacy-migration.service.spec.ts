import { StudentBalanceLedgerService } from './student-balance-ledger.service';
import { StudentBalanceLegacyMigrationService } from './student-balance-legacy-migration.service';
import { StudentEntity } from '../students/entities/student.entity';

describe('StudentBalanceLegacyMigrationService', () => {
  it('imports docs without mutating, applies orphan restores, fills recon gap', async () => {
    const student = {
      id: 'stu-1',
      name: 'Test',
      lessonBalance: 7,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-09-01'),
      mergedIntoStudentId: null,
    };

    const ledgerRows: Array<{ idempotencyKey: string; delta: number }> = [];
    let balance = 7;

    const ledger = {
      importHistorical: jest.fn(async (input: { idempotencyKey: string; delta: number }) => {
        if (ledgerRows.some((r) => r.idempotencyKey === input.idempotencyKey)) {
          return { inserted: false, entry: {} };
        }
        ledgerRows.push({ idempotencyKey: input.idempotencyKey, delta: input.delta });
        return { inserted: true, entry: {} };
      }),
      apply: jest.fn(async (input: { idempotencyKey: string; delta: number }) => {
        if (ledgerRows.some((r) => r.idempotencyKey === input.idempotencyKey)) {
          return { applied: false };
        }
        ledgerRows.push({ idempotencyKey: input.idempotencyKey, delta: input.delta });
        balance += input.delta;
        student.lessonBalance = balance;
        return { applied: true };
      }),
    };

    const lessonExists = new Set<string>();
    void lessonExists;
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === StudentEntity) {
          return {
            findOne: jest.fn(async () => ({ ...student, lessonBalance: balance })),
          };
        }
        return {};
      },
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('FROM audit_logs') && sql.includes('manual payment')) {
          return [
            {
              created_date: new Date('2026-09-01'),
              summary: 'manual payment abc: balance 0 → 12',
            },
          ];
        }
        if (sql.includes('FROM payments')) {
          return [
            {
              id: 'pay-1',
              lessons_added: 12,
              created_at: new Date('2026-09-01'),
              paid_at: new Date('2026-09-01'),
              shop_item_id: null,
              shop_type: null,
            },
          ];
        }
        if (sql.includes('lesson_deduct')) {
          return [
            {
              created_date: new Date('2026-09-02'),
              summary:
                'lesson_deduct 11111111-1111-1111-1111-111111111111 status=completed: balance 12 → 11',
            },
            {
              created_date: new Date('2026-09-03'),
              summary:
                'lesson_deduct 22222222-2222-2222-2222-222222222221 status=completed: balance 11 → 10',
            },
            {
              created_date: new Date('2026-09-03'),
              summary:
                'lesson_deduct 22222222-2222-2222-2222-222222222222 status=completed: balance 10 → 9',
            },
            {
              created_date: new Date('2026-09-03'),
              summary:
                'lesson_deduct 22222222-2222-2222-2222-222222222223 status=completed: balance 9 → 8',
            },
            {
              created_date: new Date('2026-09-03'),
              summary:
                'lesson_deduct 22222222-2222-2222-2222-222222222224 status=completed: balance 8 → 7',
            },
          ];
        }
        if (sql.includes('FROM attendance_records')) {
          return [];
        }
        if (sql.includes('FROM lessons WHERE id')) {
          const id = String(params?.[0]);
          return id === '11111111-1111-1111-1111-111111111111' ? [{ ok: 1 }] : [];
        }
        if (sql.includes('lesson_restore')) {
          return [];
        }
        if (sql.includes('student_lesson_balance_adjustments')) {
          return [];
        }
        if (sql.includes('teacher_student_balance_history')) {
          return [];
        }
        if (sql.includes('SUM(delta)')) {
          const sum = ledgerRows.reduce((a, r) => a + r.delta, 0);
          return [{ sum }];
        }
        return [];
      }),
    };

    const dataSource = {
      transaction: jest.fn(async (fn: (m: typeof manager) => Promise<unknown>) => fn(manager)),
      getRepository: () => ({
        find: jest.fn(async () => [student]),
        findOne: jest.fn(async () => ({ ...student, lessonBalance: balance })),
      }),
    };

    const service = new StudentBalanceLegacyMigrationService(
      dataSource as never,
      ledger as never,
    );

    const result = await service.importStudent('stu-1', { dryRun: false });

    expect(result.balanceBefore).toBe(7);
    // 4 orphan restores applied → 11
    expect(result.balanceAfter).toBe(11);
    expect(result.appliedMutations).toBe(4);
    expect(result.reconciled).toBe(true);
    expect(result.legacyReconciliationDelta).toBe(0);
    expect(ledger.apply).toHaveBeenCalledTimes(4);

    // Second import is idempotent (no new mutations).
    const again = await service.importStudent('stu-1', { dryRun: false });
    expect(again.appliedMutations).toBe(0);
    expect(again.balanceAfter).toBe(11);
  });

  it('creates LEGACY_RECONCILIATION for unexplained +6 (Daria pattern)', async () => {
    const student = {
      id: 'daria',
      name: 'Дария М',
      lessonBalance: 8,
      createdAt: new Date('2026-07-20'),
      updatedAt: new Date('2026-09-16'),
      mergedIntoStudentId: null,
    };
    let balance = 8;
    const ledgerRows: Array<{ idempotencyKey: string; delta: number }> = [];

    const ledger = {
      importHistorical: jest.fn(async (input: { idempotencyKey: string; delta: number }) => {
        if (ledgerRows.some((r) => r.idempotencyKey === input.idempotencyKey)) {
          return { inserted: false, entry: {} };
        }
        ledgerRows.push({ idempotencyKey: input.idempotencyKey, delta: input.delta });
        return { inserted: true, entry: {} };
      }),
      apply: jest.fn(async () => ({ applied: false })),
    };

    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === StudentEntity) {
          return {
            findOne: jest.fn(async () => ({ ...student, lessonBalance: balance })),
          };
        }
        return {};
      },
      query: jest.fn(async (sql: string) => {
        if (sql.includes('manual payment')) {
          return [
            {
              created_date: new Date('2026-07-20'),
              summary: 'manual payment x: balance 0 → 2',
            },
          ];
        }
        if (sql.includes('FROM payments')) {
          return [
            {
              id: 'p1',
              lessons_added: 2,
              created_at: new Date('2026-07-20'),
              paid_at: null,
              shop_item_id: null,
              shop_type: null,
            },
            {
              id: 'p2',
              lessons_added: 3,
              created_at: new Date('2026-07-23'),
              paid_at: null,
              shop_item_id: null,
              shop_type: null,
            },
          ];
        }
        if (sql.includes('lesson_deduct')) {
          return [
            {
              created_date: new Date('2026-08-01'),
              summary:
                'lesson_deduct aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1 status=completed: balance 11 → 10',
            },
            {
              created_date: new Date('2026-08-02'),
              summary:
                'lesson_deduct aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2 status=completed: balance 10 → 9',
            },
            {
              created_date: new Date('2026-08-03'),
              summary:
                'lesson_deduct aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3 status=completed: balance 9 → 8',
            },
          ];
        }
        if (sql.includes('FROM lessons WHERE id')) {
          return [{ x: 1 }];
        }
        if (sql.includes('SUM(delta)')) {
          return [{ sum: ledgerRows.reduce((a, r) => a + r.delta, 0) }];
        }
        return [];
      }),
    };

    const dataSource = {
      transaction: jest.fn(async (fn: (m: typeof manager) => Promise<unknown>) => fn(manager)),
    };

    const service = new StudentBalanceLegacyMigrationService(
      dataSource as never,
      ledger as never,
    );
    const result = await service.importStudent('daria', { dryRun: false });

    // payments 5 - 3 debits = 2; current 8 → recon +6
    expect(result.legacyReconciliationDelta).toBe(6);
    expect(result.balanceChanged).toBe(false);
    expect(result.reconciled).toBe(true);
    expect(
      ledgerRows.some((r) =>
        r.idempotencyKey.startsWith(StudentBalanceLedgerService.legacyReconKey('daria').slice(0, 20)),
      ),
    ).toBe(true);
  });
});
