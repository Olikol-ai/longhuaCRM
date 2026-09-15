import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Audit table for admin corrections of students.lesson_balance
 * (historical opening balance when a pupil is imported into CRM).
 */
export class StudentLessonBalanceAdjustments1747200000000 implements MigrationInterface {
  name = 'StudentLessonBalanceAdjustments1747200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "student_lesson_balance_adjustments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "student_id" uuid NOT NULL,
        "old_balance" integer NOT NULL,
        "new_balance" integer NOT NULL,
        "change_amount" integer NOT NULL,
        "reason" text NOT NULL,
        "created_by" uuid NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_student_lesson_balance_adj_student"
          FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_student_lesson_balance_adj_created_by"
          FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_STUDENT_LESSON_BALANCE_ADJ_STUDENT"
      ON "student_lesson_balance_adjustments" ("student_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_STUDENT_LESSON_BALANCE_ADJ_CREATED"
      ON "student_lesson_balance_adjustments" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_STUDENT_LESSON_BALANCE_ADJ_CREATED"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_STUDENT_LESSON_BALANCE_ADJ_STUDENT"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "student_lesson_balance_adjustments"`);
  }
}
