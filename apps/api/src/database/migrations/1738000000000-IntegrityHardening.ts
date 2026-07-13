import { MigrationInterface, QueryRunner } from 'typeorm';
import { alignLegacyForeignKeysForV2 } from '../migration-helpers';

export class IntegrityHardening1738000000000 implements MigrationInterface {
  name = 'IntegrityHardening1738000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await alignLegacyForeignKeysForV2(queryRunner);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "enrollment_lesson_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "enrollment_id" uuid NOT NULL REFERENCES "enrollments"("id") ON DELETE CASCADE,
        "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        "event_type" varchar(32) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_enrollment_lesson_event" UNIQUE ("lesson_id", "student_id", "event_type")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_enrollment_lesson_events_enrollment"
      ON "enrollment_lesson_events" ("enrollment_id");
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_enrollments_active_student_course"
      ON "enrollments" ("student_id", "course_template_id")
      WHERE "status" = 'active';
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_certificates_draft_student_course"
      ON "certificates" ("student_id", "course_id")
      WHERE "status" = 'draft';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_certificates_draft_student_course";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_enrollments_active_student_course";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "enrollment_lesson_events";`);
  }
}
