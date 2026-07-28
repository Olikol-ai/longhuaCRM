import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Private contact lesson balance + change history + attendance link for idempotent deduct.
 */
export class TeacherStudentContactBalance1742400000000 implements MigrationInterface {
  name = 'TeacherStudentContactBalance1742400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_student_contacts"
        ADD COLUMN IF NOT EXISTS "lesson_balance" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teacher_student_balance_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "student_contact_id" uuid NOT NULL,
        "old_balance" integer NOT NULL,
        "new_balance" integer NOT NULL,
        "change_amount" integer NOT NULL,
        "reason" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_by" uuid,
        CONSTRAINT "PK_teacher_student_balance_history" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TEACHER_STUDENT_BALANCE_HISTORY_CONTACT"
      ON "teacher_student_balance_history" ("student_contact_id")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "teacher_student_balance_history"
          ADD CONSTRAINT "FK_teacher_student_balance_history_contact"
          FOREIGN KEY ("student_contact_id")
          REFERENCES "teacher_student_contacts"("id")
          ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "attendance_records"
        ADD COLUMN IF NOT EXISTS "teacher_student_contact_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ATTENDANCE_TEACHER_STUDENT_CONTACT_ID"
      ON "attendance_records" ("teacher_student_contact_id")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "attendance_records"
          ADD CONSTRAINT "FK_attendance_teacher_student_contact"
          FOREIGN KEY ("teacher_student_contact_id")
          REFERENCES "teacher_student_contacts"("id")
          ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendance_records"
        DROP CONSTRAINT IF EXISTS "FK_attendance_teacher_student_contact"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_ATTENDANCE_TEACHER_STUDENT_CONTACT_ID"
    `);
    await queryRunner.query(`
      ALTER TABLE "attendance_records"
        DROP COLUMN IF EXISTS "teacher_student_contact_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "teacher_student_balance_history"
        DROP CONSTRAINT IF EXISTS "FK_teacher_student_balance_history_contact"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_TEACHER_STUDENT_BALANCE_HISTORY_CONTACT"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "teacher_student_balance_history"`);
    await queryRunner.query(`
      ALTER TABLE "teacher_student_contacts"
        DROP COLUMN IF EXISTS "lesson_balance"
    `);
  }
}
