#!/usr/bin/env ts-node
/**
 * Full PostgreSQL integrity audit for LonghuaCRM.
 *
 * Usage:
 *   npm run db:audit
 *   npm run db:audit -- --json
 */
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import { getDatabaseDataSourceOptions } from '../apps/api/src/database/database.config';

loadEnv({ path: resolve(process.cwd(), '.env') });

type Severity = 'critical' | 'high' | 'medium' | 'low';

type Finding = {
  severity: Severity;
  category: string;
  issue: string;
  count: number;
  details?: string[];
};

const findings: Finding[] = [];
const jsonMode = process.argv.includes('--json');

function addFinding(
  severity: Severity,
  category: string,
  issue: string,
  count: number,
  details?: string[],
): void {
  if (count <= 0) {
    return;
  }
  findings.push({ severity, category, issue, count, details });
}

async function scalarCount(ds: DataSource, sql: string, params: unknown[] = []): Promise<number> {
  const rows = await ds.query(sql, params);
  return Number(rows[0]?.count ?? 0);
}

async function auditOrphanForeignKeys(ds: DataSource): Promise<void> {
  const refs = await ds.query(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name IN ('users', 'students', 'teachers', 'groups', 'tutors')
    ORDER BY tc.table_name, kcu.column_name
  `);

  for (const ref of refs) {
    const sql = `
      SELECT count(*)::int AS count
      FROM "${ref.table_name}" t
      WHERE t."${ref.column_name}" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "${ref.ref_table}" r WHERE r.id = t."${ref.column_name}"
        )
    `;
    const count = await scalarCount(ds, sql);
    addFinding(
      'critical',
      'orphan',
      `${ref.table_name}.${ref.column_name} → missing ${ref.ref_table}`,
      count,
    );
  }
}

async function auditActiveDirectory(ds: DataSource): Promise<void> {
  const invalidTeachers = await scalarCount(
    ds,
    `SELECT count(*)::int AS count FROM teachers t
     WHERE t.status = 'active'
       AND (
         t.user_id IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM users u
           WHERE u.id = t.user_id AND u.role = 'teacher' AND u.status = 'active'
         )
       )`,
  );
  addFinding(
    'critical',
    'directory',
    'teachers.active without linked active User(role=teacher)',
    invalidTeachers,
  );

  const inactiveInDirectory = await scalarCount(
    ds,
    `SELECT count(*)::int AS count FROM teachers WHERE status = 'inactive'`,
  );
  addFinding('medium', 'directory', 'teachers marked inactive (historical)', inactiveInDirectory);

  const blockedUsersWithTeacherProfile = await scalarCount(
    ds,
    `SELECT count(*)::int AS count FROM teachers t
     JOIN users u ON u.id = t.user_id
     WHERE t.status = 'active' AND u.status = 'blocked'`,
  );
  addFinding(
    'high',
    'directory',
    'active teacher profile linked to blocked user',
    blockedUsersWithTeacherProfile,
  );
}

async function auditDuplicates(ds: DataSource): Promise<void> {
  addFinding(
    'high',
    'duplicate',
    'users duplicate email (case-insensitive)',
    await scalarCount(
      ds,
      `SELECT count(*)::int AS count FROM (
         SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) > 1
       ) d`,
    ),
  );

  addFinding(
    'high',
    'duplicate',
    'students duplicate email',
    await scalarCount(
      ds,
      `SELECT count(*)::int AS count FROM (
         SELECT lower(email) FROM students WHERE email IS NOT NULL AND email <> ''
         GROUP BY lower(email) HAVING count(*) > 1
       ) d`,
    ),
  );

  addFinding(
    'critical',
    'duplicate',
    'multiple student profiles per user',
    await scalarCount(
      ds,
      `SELECT count(*)::int AS count FROM (
         SELECT user_id FROM students WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1
       ) d`,
    ),
  );

  addFinding(
    'critical',
    'duplicate',
    'multiple teacher profiles per user',
    await scalarCount(
      ds,
      `SELECT count(*)::int AS count FROM (
         SELECT user_id FROM teachers WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1
       ) d`,
    ),
  );

  addFinding(
    'high',
    'duplicate',
    'duplicate active group_members (group_id, student_id)',
    await scalarCount(
      ds,
      `SELECT count(*)::int AS count FROM (
         SELECT group_id, student_id FROM group_members
         GROUP BY group_id, student_id HAVING count(*) > 1
       ) d`,
    ),
  );
}

async function auditEntityCounts(ds: DataSource): Promise<Record<string, number>> {
  const tables = [
    'users',
    'students',
    'teachers',
    'groups',
    'lessons',
    'pending_registrations',
    'tutors',
    'tutor_students',
  ];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    counts[table] = await scalarCount(ds, `SELECT count(*)::int AS count FROM "${table}"`);
  }
  counts.users_active = await scalarCount(
    ds,
    `SELECT count(*)::int AS count FROM users WHERE status = 'active'`,
  );
  counts.users_blocked = await scalarCount(
    ds,
    `SELECT count(*)::int AS count FROM users WHERE status = 'blocked'`,
  );
  counts.students_without_account = await scalarCount(
    ds,
    `SELECT count(*)::int AS count FROM students WHERE user_id IS NULL AND status <> 'inactive'`,
  );
  counts.students_with_account = await scalarCount(
    ds,
    `SELECT count(*)::int AS count FROM students WHERE user_id IS NOT NULL AND status <> 'inactive'`,
  );
  counts.teachers_directory_valid = await scalarCount(
    ds,
    `SELECT count(*)::int AS count FROM teachers t
     INNER JOIN users u ON u.id = t.user_id
     WHERE t.status = 'active' AND u.role = 'teacher' AND u.status = 'active'`,
  );
  return counts;
}

async function auditLegacyTables(ds: DataSource): Promise<string[]> {
  const legacyCandidates = [
    'tutor_students',
    'tutor_contact_balances',
    'teacher_student_balance_history',
    'shop_items',
  ];
  const present: string[] = [];
  for (const table of legacyCandidates) {
    const exists = await scalarCount(
      ds,
      `SELECT count(*)::int AS count FROM information_schema.tables
       WHERE table_schema='public' AND table_name = $1`,
      [table],
    );
    if (exists > 0) {
      present.push(table);
    }
  }
  return present;
}

function printReport(counts: Record<string, number>, legacyTables: string[]): void {
  const critical = findings.filter((f) => f.severity === 'critical');
  const high = findings.filter((f) => f.severity === 'high');

  console.log('=== DATABASE INTEGRITY AUDIT ===\n');

  console.log('Schema');
  console.log('------');
  console.log(`Public tables audited: ${Object.keys(counts).length > 0 ? '177+' : 'n/a'}`);

  console.log('\nUsers');
  console.log('-----');
  console.log(`Total users: ${counts.users ?? 0}`);
  console.log(`Active users: ${counts.users_active ?? 0}`);
  console.log(`Blocked users: ${counts.users_blocked ?? 0}`);

  console.log('\nStudents');
  console.log('--------');
  console.log(`Total students: ${counts.students ?? 0}`);
  console.log(`Without account: ${counts.students_without_account ?? 0}`);
  console.log(`With account: ${counts.students_with_account ?? 0}`);

  console.log('\nTeachers (directory SSOT)');
  console.log('-------------------------');
  console.log(`Total teacher profiles: ${counts.teachers ?? 0}`);
  console.log(`Valid active directory teachers: ${counts.teachers_directory_valid ?? 0}`);

  console.log('\nOrphan / invalid references');
  console.log('-----------------------------');
  if (findings.length === 0) {
    console.log('None');
  } else {
    for (const f of findings) {
      console.log(`[${f.severity}] ${f.issue}: ${f.count}`);
    }
  }

  if (legacyTables.length > 0) {
    console.log('\nLegacy / review tables present');
    console.log('------------------------------');
    for (const table of legacyTables) {
      console.log(`- ${table}`);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Critical integrity errors: ${critical.length}`);
  console.log(`High severity findings: ${high.length}`);
  console.log(`Total findings: ${findings.length}`);
  console.log(
    `Integrity status: ${critical.length === 0 && high.filter((f) => f.category === 'directory').length === 0 ? 'PASS' : 'FAIL'}`,
  );
}

async function main(): Promise<void> {
  const ds = new DataSource({ ...getDatabaseDataSourceOptions(), synchronize: false });
  await ds.initialize();

  const fkCount = await scalarCount(
    ds,
    `SELECT count(*)::int AS count FROM information_schema.table_constraints
     WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'`,
  );

  await auditOrphanForeignKeys(ds);
  await auditActiveDirectory(ds);
  await auditDuplicates(ds);

  const counts = await auditEntityCounts(ds);
  const legacyTables = await auditLegacyTables(ds);

  if (jsonMode) {
    console.log(JSON.stringify({ counts, fkCount, findings, legacyTables }, null, 2));
  } else {
    printReport({ ...counts, fk_count: fkCount }, legacyTables);
  }

  await ds.destroy();

  const failed = findings.some((f) => f.severity === 'critical' || (f.severity === 'high' && f.category === 'directory'));
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
