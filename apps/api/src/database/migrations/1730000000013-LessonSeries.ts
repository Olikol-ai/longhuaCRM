import { MigrationInterface, QueryRunner } from 'typeorm';

export class LessonSeries1730000000013 implements MigrationInterface {
  name = 'LessonSeries1730000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "lesson_series_status_enum" AS ENUM ('active', 'paused', 'stopped')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_series" (
        "id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "schedule_slot_id" uuid,
        "repeat_weekly" boolean NOT NULL DEFAULT true,
        "status" "lesson_series_status_enum" NOT NULL DEFAULT 'active',
        "start_date" date NOT NULL,
        "start_time" time NOT NULL,
        "duration" integer NOT NULL DEFAULT 60,
        "lesson_format" "lessons_lesson_format_enum" NOT NULL DEFAULT 'online',
        "meeting_link" text,
        "notes" text,
        "teacher_name" text,
        "teacher_first_name" text,
        "teacher_last_name" text,
        "created_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_series" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_LESSON_SERIES_TEACHER_ID"
      ON "lesson_series" ("teacher_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_series_students" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "series_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "created_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_series_students" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_LESSON_SERIES_STUDENT_UNIQUE"
      ON "lesson_series_students" ("series_id", "student_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_LESSON_SERIES_STUDENT_SERIES_ID"
      ON "lesson_series_students" ("series_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "lessons"
      ADD COLUMN IF NOT EXISTS "recurrence_series_id" uuid,
      ADD COLUMN IF NOT EXISTS "recurrence_index" integer
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_LESSON_RECURRENCE_SERIES_ID"
      ON "lessons" ("recurrence_series_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_LESSON_SERIES_RECURRENCE_INDEX"
      ON "lessons" ("recurrence_series_id", "recurrence_index")
      WHERE "recurrence_series_id" IS NOT NULL AND "recurrence_index" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "lesson_series"
      ADD CONSTRAINT "FK_lesson_series_teacher_id"
      FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE "lesson_series_students"
      ADD CONSTRAINT "FK_lesson_series_students_series_id"
      FOREIGN KEY ("series_id") REFERENCES "lesson_series"("id") ON DELETE CASCADE NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE "lesson_series_students"
      ADD CONSTRAINT "FK_lesson_series_students_student_id"
      FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE "lessons"
      ADD CONSTRAINT "FK_lessons_recurrence_series_id"
      FOREIGN KEY ("recurrence_series_id") REFERENCES "lesson_series"("id") ON DELETE SET NULL NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE "lesson_series" VALIDATE CONSTRAINT "FK_lesson_series_teacher_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "lesson_series_students" VALIDATE CONSTRAINT "FK_lesson_series_students_series_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "lesson_series_students" VALIDATE CONSTRAINT "FK_lesson_series_students_student_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "lessons" VALIDATE CONSTRAINT "FK_lessons_recurrence_series_id"
    `);

    await queryRunner.query(`
      INSERT INTO "lesson_series" (
        "id", "teacher_id", "schedule_slot_id", "repeat_weekly", "status", "start_date",
        "start_time", "duration", "lesson_format", "meeting_link", "notes",
        "teacher_name", "teacher_first_name", "teacher_last_name", "created_date", "updated_date"
      )
      SELECT DISTINCT ON (COALESCE(l."recurring_group_id", l."id"))
        COALESCE(l."recurring_group_id", l."id"),
        l."teacher_id",
        l."schedule_slot_id",
        true,
        'active',
        l."date",
        l."start_time",
        COALESCE(l."duration", 60),
        l."lesson_format",
        l."meeting_link",
        l."notes",
        l."teacher_name",
        l."teacher_first_name",
        l."teacher_last_name",
        NOW(),
        NOW()
      FROM "lessons" l
      WHERE l."is_recurring" = true
      ORDER BY COALESCE(l."recurring_group_id", l."id"), l."date" ASC
      ON CONFLICT ("id") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "lesson_series_students" ("series_id", "student_id", "created_date", "updated_date")
      SELECT DISTINCT
        COALESCE(l."recurring_group_id", l."id"),
        ls."student_id",
        NOW(),
        NOW()
      FROM "lessons" l
      INNER JOIN "lesson_students" ls ON ls."lesson_id" = l."id"
      WHERE l."is_recurring" = true
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "lesson_series_students" ("series_id", "student_id", "created_date", "updated_date")
      SELECT DISTINCT
        COALESCE(l."recurring_group_id", l."id"),
        l."student_id",
        NOW(),
        NOW()
      FROM "lessons" l
      WHERE l."is_recurring" = true
        AND l."student_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "lesson_series_students" lss
          WHERE lss."series_id" = COALESCE(l."recurring_group_id", l."id")
            AND lss."student_id" = l."student_id"
        )
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          l."id",
          COALESCE(l."recurring_group_id", l."id") AS series_id,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(l."recurring_group_id", l."id")
            ORDER BY l."date" ASC, l."start_time" ASC, l."created_date" ASC
          ) - 1 AS recurrence_index
        FROM "lessons" l
        WHERE l."is_recurring" = true
      )
      UPDATE "lessons" l
      SET
        "recurrence_series_id" = ranked.series_id,
        "recurrence_index" = ranked.recurrence_index
      FROM ranked
      WHERE l."id" = ranked."id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "lessons" DROP CONSTRAINT IF EXISTS "FK_lessons_recurrence_series_id"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "lesson_series_students" DROP CONSTRAINT IF EXISTS "FK_lesson_series_students_student_id"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "lesson_series_students" DROP CONSTRAINT IF EXISTS "FK_lesson_series_students_series_id"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "lesson_series" DROP CONSTRAINT IF EXISTS "FK_lesson_series_teacher_id"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_LESSON_SERIES_RECURRENCE_INDEX"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_LESSON_RECURRENCE_SERIES_ID"`);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "lessons"
      DROP COLUMN IF EXISTS "recurrence_index",
      DROP COLUMN IF EXISTS "recurrence_series_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_series_students"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_series"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "lesson_series_status_enum"`);
  }
}
