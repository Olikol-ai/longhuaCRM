import { MigrationInterface, QueryRunner } from 'typeorm';

export class LessonSeriesSlots1739200000000 implements MigrationInterface {
  name = 'LessonSeriesSlots1739200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_series_slots" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "lesson_series_id" uuid NOT NULL,
        "day_of_week" integer NOT NULL,
        "start_time" time NOT NULL,
        "end_time" time,
        CONSTRAINT "PK_lesson_series_slots" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lesson_series_slots_series"
          FOREIGN KEY ("lesson_series_id") REFERENCES "lesson_series"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_LESSON_SERIES_SLOT_SERIES"
      ON "lesson_series_slots" ("lesson_series_id")
    `);

    await queryRunner.query(`
      INSERT INTO "lesson_series_slots" ("id", "lesson_series_id", "day_of_week", "start_time")
      SELECT
        gen_random_uuid(),
        ls."id",
        CASE EXTRACT(DOW FROM ls."start_date"::date)::int
          WHEN 0 THEN 6
          ELSE EXTRACT(DOW FROM ls."start_date"::date)::int - 1
        END,
        ls."start_time"
      FROM "lesson_series" ls
      WHERE NOT EXISTS (
        SELECT 1 FROM "lesson_series_slots" slot WHERE slot."lesson_series_id" = ls."id"
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_series_slots"`);
  }
}
