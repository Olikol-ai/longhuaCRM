import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Password recovery: store hashed reset token + expiry on users.
 */
export class PasswordResetTokens1739800000000 implements MigrationInterface {
  name = 'PasswordResetTokens1739800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "password_reset_token" text,
        ADD COLUMN IF NOT EXISTS "password_reset_expires_at" timestamptz
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_password_reset_token"
        ON "users" ("password_reset_token")
        WHERE "password_reset_token" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_password_reset_token"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "password_reset_expires_at",
        DROP COLUMN IF EXISTS "password_reset_token"
    `);
  }
}
