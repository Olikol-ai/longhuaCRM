import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tutor self-profile: photo, experience, specialization, work hours,
 * learning directions, teaching languages, lesson durations, work days,
 * and tutor_materials foundation for future content.
 */
export class TutorProfileAndSettings1742200000000 implements MigrationInterface {
  name = 'TutorProfileAndSettings1742200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tutors"
        ADD COLUMN IF NOT EXISTS "photo_url" text,
        ADD COLUMN IF NOT EXISTS "teaching_experience" text,
        ADD COLUMN IF NOT EXISTS "specialization" text,
        ADD COLUMN IF NOT EXISTS "work_time_from" time,
        ADD COLUMN IF NOT EXISTS "work_time_to" time
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tutor_learning_directions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutor_id" uuid NOT NULL,
        "name" text NOT NULL,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tutor_learning_directions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tutor_learning_directions_tutor"
          FOREIGN KEY ("tutor_id") REFERENCES "tutors"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TUTOR_LEARNING_DIRECTIONS_TUTOR_ID"
      ON "tutor_learning_directions" ("tutor_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tutor_teaching_languages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutor_id" uuid NOT NULL,
        "name" text NOT NULL,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tutor_teaching_languages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tutor_teaching_languages_tutor"
          FOREIGN KEY ("tutor_id") REFERENCES "tutors"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TUTOR_TEACHING_LANGUAGES_TUTOR_ID"
      ON "tutor_teaching_languages" ("tutor_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tutor_lesson_durations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutor_id" uuid NOT NULL,
        "minutes" int NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tutor_lesson_durations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tutor_lesson_durations_tutor_minutes" UNIQUE ("tutor_id", "minutes"),
        CONSTRAINT "FK_tutor_lesson_durations_tutor"
          FOREIGN KEY ("tutor_id") REFERENCES "tutors"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_tutor_lesson_durations_minutes"
          CHECK ("minutes" IN (30, 60, 90, 120))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TUTOR_LESSON_DURATIONS_TUTOR_ID"
      ON "tutor_lesson_durations" ("tutor_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tutor_work_days" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutor_id" uuid NOT NULL,
        "day_of_week" smallint NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tutor_work_days" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tutor_work_days_tutor_day" UNIQUE ("tutor_id", "day_of_week"),
        CONSTRAINT "FK_tutor_work_days_tutor"
          FOREIGN KEY ("tutor_id") REFERENCES "tutors"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_tutor_work_days_day"
          CHECK ("day_of_week" >= 0 AND "day_of_week" <= 6)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TUTOR_WORK_DAYS_TUTOR_ID"
      ON "tutor_work_days" ("tutor_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tutor_materials" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tutor_id" uuid NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "external_link" text,
        "file_url" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tutor_materials" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tutor_materials_tutor"
          FOREIGN KEY ("tutor_id") REFERENCES "tutors"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TUTOR_MATERIALS_TUTOR_ID"
      ON "tutor_materials" ("tutor_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tutor_materials"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tutor_work_days"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tutor_lesson_durations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tutor_teaching_languages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tutor_learning_directions"`);
    await queryRunner.query(`
      ALTER TABLE "tutors"
        DROP COLUMN IF EXISTS "work_time_to",
        DROP COLUMN IF EXISTS "work_time_from",
        DROP COLUMN IF EXISTS "specialization",
        DROP COLUMN IF EXISTS "teaching_experience",
        DROP COLUMN IF EXISTS "photo_url"
    `);
  }
}
