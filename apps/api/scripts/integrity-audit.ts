/**
 * Database integrity audit — run when PostgreSQL is available:
 *   npx ts-node --project tsconfig.json apps/api/scripts/integrity-audit.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getDatabaseDataSourceOptions } from '../src/database/database.config';

type Finding = {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  count?: number;
};

const findings: Finding[] = [];

async function countOrphans(ds: DataSource, sql: string, label: string, severity: Finding['severity']) {
  const rows = await ds.query(sql);
  const count = Number(rows[0]?.count ?? 0);
  if (count > 0) {
    findings.push({ severity, category: 'orphan', issue: label, count });
  }
}

async function main() {
  const ds = new DataSource({ ...getDatabaseDataSourceOptions(), synchronize: false });
  await ds.initialize();

  await countOrphans(
    ds,
    `SELECT COUNT(*)::int AS count FROM students s
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.user_id IS NOT NULL AND u.id IS NULL`,
    'students.user_id points to missing users',
    'high',
  );

  await countOrphans(
    ds,
    `SELECT COUNT(*)::int AS count FROM teachers t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.user_id IS NOT NULL AND u.id IS NULL`,
    'teachers.user_id points to missing users',
    'high',
  );

  await countOrphans(
    ds,
    `SELECT COUNT(*)::int AS count FROM attendance_records a
     LEFT JOIN lessons l ON l.id = a.lesson_id
     WHERE l.id IS NULL`,
    'attendance_records without lesson',
    'critical',
  );

  await countOrphans(
    ds,
    `SELECT COUNT(*)::int AS count FROM attendance_records a
     LEFT JOIN students s ON s.id = a.student_id
     WHERE s.id IS NULL`,
    'attendance_records without student',
    'critical',
  );

  await countOrphans(
    ds,
    `SELECT COUNT(*)::int AS count FROM enrollments e
     LEFT JOIN students s ON s.id = e.student_id
     WHERE s.id IS NULL`,
    'enrollments without student',
    'critical',
  );

  await countOrphans(
    ds,
    `SELECT COUNT(*)::int AS count FROM payments p
     LEFT JOIN students s ON s.id = p.student_id
     WHERE s.id IS NULL`,
    'payments without student',
    'critical',
  );

  await countOrphans(
    ds,
    `SELECT COUNT(*)::int AS count FROM teacher_availability_bookings b
     LEFT JOIN lessons l ON l.id = b.lesson_id
     WHERE b.lesson_id IS NOT NULL AND l.id IS NULL`,
    'availability bookings referencing missing lessons',
    'high',
  );

  const duplicateEnrollments = await ds.query(`
    SELECT student_id, course_template_id, COUNT(*)::int AS cnt
    FROM enrollments
    WHERE status = 'active'
    GROUP BY student_id, course_template_id
    HAVING COUNT(*) > 1
    LIMIT 20
  `);
  if (duplicateEnrollments.length > 0) {
    findings.push({
      severity: 'high',
      category: 'unique',
      issue: 'duplicate active enrollments per student/course',
      count: duplicateEnrollments.length,
    });
  }

  const duplicateDraftCerts = await ds.query(`
    SELECT student_id, course_id, COUNT(*)::int AS cnt
    FROM certificates
    WHERE status = 'draft'
    GROUP BY student_id, course_id
    HAVING COUNT(*) > 1
    LIMIT 20
  `);
  if (duplicateDraftCerts.length > 0) {
    findings.push({
      severity: 'high',
      category: 'unique',
      issue: 'duplicate draft certificates per student/course',
      count: duplicateDraftCerts.length,
    });
  }

  const missingFks = await ds.query(`
    SELECT tc.constraint_name, tc.table_name
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name
  `);

  console.log(JSON.stringify({ findings, foreignKeyCount: missingFks.length }, null, 2));
  await ds.destroy();
  process.exit(findings.some((f) => f.severity === 'critical') ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
