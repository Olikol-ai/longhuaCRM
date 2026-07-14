import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Deep-link Telegram: users.telegram_connected_at
 * Re-add lessons.reminder_24h_sent for 24h informational reminders (idempotency).
 */
export class TelegramDeepLinkAnd24hReminder1739700000000 implements MigrationInterface {
  name = 'TelegramDeepLinkAnd24hReminder1739700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "telegram_connected_at" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "lessons"
        ADD COLUMN IF NOT EXISTS "reminder_24h_sent" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lessons" DROP COLUMN IF EXISTS "reminder_24h_sent"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "telegram_connected_at"
    `);
  }
}
