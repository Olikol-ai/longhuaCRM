import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Decline no longer asks for free-text reason in Telegram.
 * Remove pending-input table used by the old multi-step decline UX.
 */
export class DropTelegramPendingInput1739900000000 implements MigrationInterface {
  name = 'DropTelegramPendingInput1739900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "telegram_pending_inputs"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "telegram_pending_inputs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "chat_id" varchar(64) NOT NULL,
        "kind" varchar(64) NOT NULL DEFAULT 'decline_reason',
        "lesson_confirmation_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_telegram_pending_inputs_chat_id"
        ON "telegram_pending_inputs" ("chat_id")
    `);
  }
}
