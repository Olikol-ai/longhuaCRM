import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeacherAvailabilityBookings1730000000012 implements MigrationInterface {
  name = 'TeacherAvailabilityBookings1730000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "teacher_availability_booking_status_enum" AS ENUM ('active', 'cancelled')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teacher_availability_bookings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "teacher_id" uuid NOT NULL,
        "lesson_id" uuid NOT NULL,
        "date" date NOT NULL,
        "time_from" time NOT NULL,
        "time_to" time NOT NULL,
        "status" "teacher_availability_booking_status_enum" NOT NULL DEFAULT 'active',
        "created_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teacher_availability_bookings" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TAB_BOOKING_TEACHER_ID"
      ON "teacher_availability_bookings" ("teacher_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TAB_BOOKING_LESSON_ID"
      ON "teacher_availability_bookings" ("lesson_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TAB_BOOKING_TEACHER_DATE"
      ON "teacher_availability_bookings" ("teacher_id", "date")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_TAB_BOOKING_ACTIVE_LESSON"
      ON "teacher_availability_bookings" ("lesson_id")
      WHERE "status" = 'active'
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_availability_bookings"
      ADD CONSTRAINT "FK_tab_teacher_id"
      FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_availability_bookings"
      ADD CONSTRAINT "FK_tab_lesson_id"
      FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_availability_bookings" VALIDATE CONSTRAINT "FK_tab_teacher_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_availability_bookings" VALIDATE CONSTRAINT "FK_tab_lesson_id"
    `);

    await queryRunner.query(`
      INSERT INTO "teacher_availability_bookings" (
        "id", "teacher_id", "lesson_id", "date", "time_from", "time_to", "status", "created_date", "updated_date"
      )
      SELECT
        gen_random_uuid(),
        l."teacher_id",
        l."id",
        l."date",
        l."start_time",
        (l."start_time" + make_interval(mins => COALESCE(l."duration", 60)))::time,
        'active',
        NOW(),
        NOW()
      FROM "lessons" l
      WHERE l."status" NOT IN ('cancelled')
        AND NOT EXISTS (
          SELECT 1
          FROM "teacher_availability_bookings" b
          WHERE b."lesson_id" = l."id" AND b."status" = 'active'
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "teacher_availability_bookings"
      DROP CONSTRAINT IF EXISTS "FK_tab_lesson_id"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "teacher_availability_bookings"
      DROP CONSTRAINT IF EXISTS "FK_tab_teacher_id"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_TAB_BOOKING_ACTIVE_LESSON"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_TAB_BOOKING_TEACHER_DATE"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_TAB_BOOKING_LESSON_ID"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_TAB_BOOKING_TEACHER_ID"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teacher_availability_bookings"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "teacher_availability_booking_status_enum"`);
  }
}
