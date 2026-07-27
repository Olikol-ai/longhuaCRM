import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RepairAttendanceDuplicatesAndConstraints
 *
 * Guarantees 1 attendance record per (lesson_id, student_id).
 * 1) deletes duplicates (keeping the earliest row)
 * 2) creates a unique index (idempotent)
 */
export class RepairAttendanceDuplicatesAndConstraints1741400000000
  implements MigrationInterface
{
  name = 'RepairAttendanceDuplicatesAndConstraints1741400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          lesson_id,
          student_id,
          ROW_NUMBER() OVER (
            PARTITION BY lesson_id, student_id
            ORDER BY created_at ASC, id ASC
          ) AS rn
        FROM attendance_records
        WHERE student_id IS NOT NULL
      )
      DELETE FROM attendance_records ar
      USING ranked r
      WHERE ar.id = r.id
        AND r.rn > 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_ATTENDANCE_LESSON_STUDENT
      ON attendance_records (lesson_id, student_id)
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Data repair + constraint: irreversible.
  }
}

