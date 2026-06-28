import { MigrationInterface, QueryRunner } from 'typeorm';

export class LessonSeriesHardening1730000000014 implements MigrationInterface {
  name = 'LessonSeriesHardening1730000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lessons"
      ADD COLUMN IF NOT EXISTS "manually_modified" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_LESSON_SERIES_ACTIVE_SIGNATURE_WITH_SLOT"
      ON "lesson_series" ("teacher_id", "schedule_slot_id", "start_date", "start_time")
      WHERE "status" = 'active' AND "schedule_slot_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_LESSON_SERIES_ACTIVE_SIGNATURE_NO_SLOT"
      ON "lesson_series" ("teacher_id", "start_date", "start_time")
      WHERE "status" = 'active' AND "schedule_slot_id" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_series_exclusions" (
        "id" uuid NOT NULL,
        "series_id" uuid NOT NULL,
        "recurrence_index" integer NOT NULL,
        "reason" character varying(32) NOT NULL,
        "created_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_series_exclusions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lesson_series_exclusions_series"
          FOREIGN KEY ("series_id") REFERENCES "lesson_series"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_LESSON_SERIES_EXCLUSION_SERIES_INDEX"
      ON "lesson_series_exclusions" ("series_id", "recurrence_index")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_LESSON_SERIES_EXCLUSION_SERIES_INDEX"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_series_exclusions"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_LESSON_SERIES_ACTIVE_SIGNATURE_NO_SLOT"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_LESSON_SERIES_ACTIVE_SIGNATURE_WITH_SLOT"`);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "lessons"
      DROP COLUMN IF EXISTS "manually_modified"
    `);
  }
}
