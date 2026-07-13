import { MigrationInterface, QueryRunner } from 'typeorm';
import { rebindStudentFkToSetNull } from '../migration-helpers';

/**
 * Student profile deletion must preserve CRM history.
 * Financial, attendance, certificate, enrollment, and lesson rows keep
 * student_id = NULL instead of blocking DELETE or cascading away history.
 *
 * CASCADE remains on group_members and lesson_series_students — membership links only.
 */
export class StudentDeletionSetNull1739100000000 implements MigrationInterface {
  name = 'StudentDeletionSetNull1739100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const setNullTargets = [
      { table: 'payments', column: 'student_id', name: 'FK_payments_student_id_set_null' },
      { table: 'certificates', column: 'student_id', name: 'FK_certificates_student_id_set_null' },
      { table: 'attendance_records', column: 'student_id', name: 'FK_attendance_student_id_set_null' },
      { table: 'enrollments', column: 'student_id', name: 'FK_enrollments_student_id_set_null' },
      { table: 'enrollment_lesson_events', column: 'student_id', name: 'FK_enrollment_lesson_events_student_id_set_null' },
    ];

    for (const fk of setNullTargets) {
      await rebindStudentFkToSetNull(queryRunner, fk.table, fk.column, fk.name);
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'alfa_bank_orders' AND column_name = 'student_id'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'students'
        ) THEN
          ALTER TABLE "alfa_bank_orders" ALTER COLUMN "student_id" DROP NOT NULL;
        END IF;
      END $$;
    `);

    await rebindStudentFkToSetNull(
      queryRunner,
      'alfa_bank_orders',
      'student_id',
      'FK_alfa_bank_orders_student_id_set_null',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      { table: 'alfa_bank_orders', name: 'FK_alfa_bank_orders_student_id_set_null' },
      { table: 'enrollment_lesson_events', name: 'FK_enrollment_lesson_events_student_id_set_null' },
      { table: 'enrollments', name: 'FK_enrollments_student_id_set_null' },
      { table: 'attendance_records', name: 'FK_attendance_student_id_set_null' },
      { table: 'certificates', name: 'FK_certificates_student_id_set_null' },
      { table: 'payments', name: 'FK_payments_student_id_set_null' },
    ];

    for (const fk of tables) {
      await queryRunner.query(
        `ALTER TABLE "${fk.table}" DROP CONSTRAINT IF EXISTS "${fk.name}"`,
      );
    }
  }
}
