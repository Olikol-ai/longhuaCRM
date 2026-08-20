import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Idempotency log for daily Telegram digests of tomorrow's lessons
 * (teachers + tutors). Unique per recipient + schedule date.
 */
export class InstructorScheduleDigests1746000000000 implements MigrationInterface {
  name = 'InstructorScheduleDigests1746000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "instructor_schedule_digests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "recipient_kind" varchar(16) NOT NULL,
        "recipient_id" uuid NOT NULL,
        "schedule_date" date NOT NULL,
        "sent_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "lesson_count" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_instructor_schedule_digests" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_instructor_schedule_digests_kind"
          CHECK ("recipient_kind" IN ('teacher', 'tutor')),
        CONSTRAINT "UQ_instructor_schedule_digests_recipient_date"
          UNIQUE ("recipient_kind", "recipient_id", "schedule_date")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_instructor_schedule_digests_date"
        ON "instructor_schedule_digests" ("schedule_date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "instructor_schedule_digests"
    `);
  }
}
