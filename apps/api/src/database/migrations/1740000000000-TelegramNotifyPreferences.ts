import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * User-level Telegram notification preferences (CRM source of truth).
 */
export class TelegramNotifyPreferences1740000000000 implements MigrationInterface {
  name = 'TelegramNotifyPreferences1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "telegram_notify_24h" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "telegram_notify_3h" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "telegram_notify_3h",
        DROP COLUMN IF EXISTS "telegram_notify_24h"
    `);
  }
}
