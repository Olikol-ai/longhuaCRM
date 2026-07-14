import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rebuild lesson_confirmations for the 3-hour confirmation flow.
 * Drops legacy reminder columns on lessons.
 */
export class LessonConfirmation3hRebuild1739600000000 implements MigrationInterface {
  name = 'LessonConfirmation3hRebuild1739600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "telegram_pending_inputs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_confirmations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "lesson_confirmation_status"`);

    await queryRunner.query(`
      CREATE TYPE "lesson_confirmation_status" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED')
    `);

    await queryRunner.query(`
      CREATE TABLE "lesson_confirmations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        "telegram_chat_id" varchar(64),
        "status" "lesson_confirmation_status" NOT NULL DEFAULT 'PENDING',
        "requested_at" timestamptz,
        "confirmed_at" timestamptz,
        "declined_at" timestamptz,
        "decline_reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_lesson_confirmations_lesson_student" UNIQUE ("lesson_id", "student_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_lesson_confirmations_lesson_id"
      ON "lesson_confirmations" ("lesson_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_lesson_confirmations_student_id"
      ON "lesson_confirmations" ("student_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_lesson_confirmations_status"
      ON "lesson_confirmations" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_lesson_confirmations_telegram_chat_id"
      ON "lesson_confirmations" ("telegram_chat_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "telegram_pending_inputs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "chat_id" varchar(64) NOT NULL,
        "kind" varchar(64) NOT NULL DEFAULT 'decline_reason',
        "lesson_confirmation_id" uuid NOT NULL
          REFERENCES "lesson_confirmations"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_telegram_pending_inputs_chat_id" UNIQUE ("chat_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_telegram_pending_inputs_confirmation"
      ON "telegram_pending_inputs" ("lesson_confirmation_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "lessons"
        DROP COLUMN IF EXISTS "reminder_24h_sent",
        DROP COLUMN IF EXISTS "reminder_2h_sent"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lessons"
        ADD COLUMN IF NOT EXISTS "reminder_24h_sent" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "reminder_2h_sent" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "telegram_pending_inputs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_confirmations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "lesson_confirmation_status"`);

    await queryRunner.query(`
      CREATE TYPE "lesson_confirmation_status" AS ENUM ('pending', 'confirmed', 'declined')
    `);
    await queryRunner.query(`
      CREATE TABLE "lesson_confirmations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        "status" "lesson_confirmation_status" NOT NULL DEFAULT 'pending',
        "confirmed_at" timestamptz,
        "declined_at" timestamptz,
        "declined_reason" text,
        "request_sent_at" timestamptz,
        "reminder_1h_sent_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_lesson_confirmations_lesson_student" UNIQUE ("lesson_id", "student_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "telegram_pending_inputs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "chat_id" varchar(64) NOT NULL,
        "kind" varchar(64) NOT NULL DEFAULT 'decline_reason',
        "lesson_confirmation_id" uuid NOT NULL
          REFERENCES "lesson_confirmations"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_telegram_pending_inputs_chat_id" UNIQUE ("chat_id")
      )
    `);
  }
}
