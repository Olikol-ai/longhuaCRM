import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physically remove lesson_balance from teacher_student_contacts.
 *
 * School teachers: SSOT remains students.lesson_balance (already migrated).
 * Tutors: move private pack balance into tutor_contact_balances (1:1 with contact).
 */
export class DropContactLessonBalanceTutorTable1745900000000
  implements MigrationInterface
{
  name = 'DropContactLessonBalanceTutorTable1745900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tutor_contact_balances" (
        "contact_id" uuid NOT NULL,
        "lesson_balance" integer NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tutor_contact_balances" PRIMARY KEY ("contact_id"),
        CONSTRAINT "FK_tutor_contact_balances_contact"
          FOREIGN KEY ("contact_id")
          REFERENCES "teacher_student_contacts"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO "tutor_contact_balances" ("contact_id", "lesson_balance")
      SELECT c.id, COALESCE(c.lesson_balance, 0)
      FROM "teacher_student_contacts" c
      WHERE c.owner_type = 'tutor'
      ON CONFLICT ("contact_id") DO UPDATE
        SET "lesson_balance" = EXCLUDED."lesson_balance"
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_student_contacts"
        DROP COLUMN IF EXISTS "lesson_balance"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_student_contacts"
        ADD COLUMN IF NOT EXISTS "lesson_balance" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      UPDATE "teacher_student_contacts" AS c
      SET "lesson_balance" = COALESCE(b.lesson_balance, 0)
      FROM "tutor_contact_balances" AS b
      WHERE b.contact_id = c.id
        AND c.owner_type = 'tutor'
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "tutor_contact_balances"`);

    await queryRunner.query(`
      COMMENT ON COLUMN teacher_student_contacts.lesson_balance IS
        'Restored by down migration; prefer tutor_contact_balances for tutors.'
    `);
  }
}
