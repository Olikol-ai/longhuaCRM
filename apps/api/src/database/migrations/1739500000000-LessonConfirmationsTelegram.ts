import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lesson confirmation flow + student Telegram metadata.
 * Keeps students.telegram_id as chat id column.
 */
export class LessonConfirmationsTelegram1739500000000 implements MigrationInterface {
  name = 'LessonConfirmationsTelegram1739500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "students"
        ADD COLUMN IF NOT EXISTS "telegram_username" text,
        ADD COLUMN IF NOT EXISTS "telegram_connected_at" timestamptz
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "lesson_confirmation_status" AS ENUM ('pending', 'confirmed', 'declined');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_confirmations" (
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
      CREATE INDEX IF NOT EXISTS "IDX_lesson_confirmations_lesson_id"
      ON "lesson_confirmations" ("lesson_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lesson_confirmations_student_id"
      ON "lesson_confirmations" ("student_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lesson_confirmations_status"
      ON "lesson_confirmations" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "telegram_pending_inputs" (
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
      CREATE INDEX IF NOT EXISTS "IDX_telegram_pending_inputs_confirmation"
      ON "telegram_pending_inputs" ("lesson_confirmation_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "telegram_pending_inputs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_confirmations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "lesson_confirmation_status"`);
    await queryRunner.query(`
      ALTER TABLE "students"
        DROP COLUMN IF EXISTS "telegram_connected_at",
        DROP COLUMN IF EXISTS "telegram_username"
    `);
  }
}
