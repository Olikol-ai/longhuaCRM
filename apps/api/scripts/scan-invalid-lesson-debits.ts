#!/usr/bin/env ts-node
/**
 * Read-only scan: ledger/attendance debits on cancelled|rescheduled|missed|planned.
 * Optionally apply restores with --apply (proven invalid only).
 */
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { getDatabaseDataSourceOptions } from '../src/database/database.config';

loadEnv({ path: resolve(__dirname, '../../../.env') });

const apply = process.argv.includes('--apply');

async function main(): Promise<void> {
  const ds = new DataSource({ ...getDatabaseDataSourceOptions(), synchronize: false });
  await ds.initialize();
  try {
    const rows = await ds.query(`
      SELECT s.id AS student_id, s.name, l.id AS lesson_id, l.status, l.date::text AS date,
             a.balance_deducted,
             lb.id AS ledger_debit_id,
             EXISTS (
               SELECT 1 FROM student_balance_ledger r
               WHERE r.student_id = s.id
                 AND r.source_id = l.id::text
                 AND r.operation_type = 'restore'
             ) AS already_restored
      FROM attendance_records a
      JOIN lessons l ON l.id = a.lesson_id
      LEFT JOIN teacher_student_contacts c ON c.id = a.teacher_student_contact_id
      LEFT JOIN students s ON s.id = COALESCE(a.student_id, c.linked_student_id)
      LEFT JOIN student_balance_ledger lb
        ON lb.student_id = s.id
       AND lb.source_id = l.id::text
       AND lb.operation_type = 'debit'
      WHERE a.balance_deducted = true
        AND l.status IN ('cancelled', 'rescheduled', 'missed', 'planned')
      ORDER BY s.name, l.date
    `);

    const ledgerOnly = await ds.query(`
      SELECT s.id AS student_id, s.name, l.id AS lesson_id, l.status, l.date::text AS date,
             true AS balance_deducted,
             lb.id AS ledger_debit_id,
             EXISTS (
               SELECT 1 FROM student_balance_ledger r
               WHERE r.student_id = s.id
                 AND r.source_id = l.id::text
                 AND r.operation_type = 'restore'
             ) AS already_restored
      FROM student_balance_ledger lb
      JOIN students s ON s.id = lb.student_id
      JOIN lessons l ON l.id::text = lb.source_id
      WHERE lb.operation_type = 'debit'
        AND lb.source_type IN ('lesson', 'attendance')
        AND l.status IN ('cancelled', 'rescheduled', 'missed', 'planned')
      ORDER BY s.name, l.date
    `);

    const byKey = new Map<string, (typeof rows)[0]>();
    for (const row of [...rows, ...ledgerOnly]) {
      if (!row.student_id || !row.lesson_id) continue;
      byKey.set(`${row.student_id}:${row.lesson_id}`, row);
    }
    const invalid = [...byKey.values()];
    const needsRestore = invalid.filter((r) => !r.already_restored);

    console.log(
      JSON.stringify(
        {
          mode: apply ? 'APPLY' : 'REPORT',
          invalidDeductionsFound: invalid.length,
          needingRestore: needsRestore.length,
          rows: invalid,
        },
        null,
        2,
      ),
    );

    if (apply && needsRestore.length > 0) {
      const { StudentBalanceLedgerService } = await import(
        '../src/modules/student-balances/student-balance-ledger.service'
      );
      const ledger = new StudentBalanceLedgerService(ds);
      let restored = 0;
      for (const row of needsRestore) {
        const key = StudentBalanceLedgerService.restoreKey(row.lesson_id, row.student_id);
        const result = await ledger.apply({
          studentId: row.student_id,
          delta: 1,
          operationType: 'restore',
          sourceType: 'lesson',
          sourceId: row.lesson_id,
          idempotencyKey: key,
          description:
            `Restore balance for ${row.status} lesson incorrectly deducted by previous logic ` +
            `(lesson ${row.lesson_id})`,
        });
        if (result.applied) {
          restored += 1;
          await ds.query(
            `UPDATE attendance_records SET balance_deducted = false
             WHERE lesson_id = $1 AND balance_deducted = true
               AND (student_id = $2 OR teacher_student_contact_id IN (
                 SELECT id FROM teacher_student_contacts WHERE linked_student_id = $2
               ))`,
            [row.lesson_id, row.student_id],
          );
        }
      }
      console.log(JSON.stringify({ restored }, null, 2));
    }
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
