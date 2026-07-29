import { MigrationInterface, QueryRunner } from 'typeorm';

export class TutorHomeworkOwnership1742600000000 implements MigrationInterface {
  name = 'TutorHomeworkOwnership1742600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE homeworks
      ADD COLUMN IF NOT EXISTS tutor_id uuid NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORKS_TUTOR ON homeworks (tutor_id)`,
    );

    await queryRunner.query(`
      ALTER TABLE homework_assignments
      ALTER COLUMN student_id DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE homework_assignments
      ADD COLUMN IF NOT EXISTS tutor_student_id uuid NULL,
      ADD COLUMN IF NOT EXISTS manual_status varchar(32) NULL,
      ADD COLUMN IF NOT EXISTS review_result text NULL,
      ADD COLUMN IF NOT EXISTS owner_comment text NULL,
      ADD COLUMN IF NOT EXISTS manual_checked_at timestamptz NULL,
      ADD COLUMN IF NOT EXISTS returned_for_revision_at timestamptz NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_ASSIGNMENTS_TUTOR_STUDENT
       ON homework_assignments (tutor_student_id)`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS UQ_HOMEWORK_ASSIGNMENTS_HW_STUDENT`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_HOMEWORK_ASSIGNMENTS_HW_STUDENT_NONNULL
      ON homework_assignments (homework_id, student_id)
      WHERE student_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_HOMEWORK_ASSIGNMENTS_HW_TUTOR_STUDENT_NONNULL
      ON homework_assignments (homework_id, tutor_student_id)
      WHERE tutor_student_id IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE homework_attempts
      ALTER COLUMN student_id DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE homework_attempts
      ADD COLUMN IF NOT EXISTS tutor_student_id uuid NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_ATTEMPTS_TUTOR_STUDENT
       ON homework_attempts (tutor_student_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_HOMEWORK_ATTEMPTS_TUTOR_STUDENT`,
    );
    await queryRunner.query(`
      ALTER TABLE homework_attempts
      DROP COLUMN IF EXISTS tutor_student_id
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS UQ_HOMEWORK_ASSIGNMENTS_HW_TUTOR_STUDENT_NONNULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS UQ_HOMEWORK_ASSIGNMENTS_HW_STUDENT_NONNULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_HOMEWORK_ASSIGNMENTS_TUTOR_STUDENT`,
    );
    await queryRunner.query(`
      ALTER TABLE homework_assignments
      DROP COLUMN IF EXISTS tutor_student_id,
      DROP COLUMN IF EXISTS manual_status,
      DROP COLUMN IF EXISTS review_result,
      DROP COLUMN IF EXISTS owner_comment,
      DROP COLUMN IF EXISTS manual_checked_at,
      DROP COLUMN IF EXISTS returned_for_revision_at
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_HOMEWORK_ASSIGNMENTS_HW_STUDENT
      ON homework_assignments (homework_id, student_id)
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS IDX_HOMEWORKS_TUTOR`);
    await queryRunner.query(`
      ALTER TABLE homeworks
      DROP COLUMN IF EXISTS tutor_id
    `);
  }
}
