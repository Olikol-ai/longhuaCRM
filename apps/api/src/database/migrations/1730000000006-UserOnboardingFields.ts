import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserOnboardingFields1730000000006 implements MigrationInterface {
  name = 'UserOnboardingFields1730000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS "verification_code" text,
        ADD COLUMN IF NOT EXISTS "telegram_username" text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS "telegram_link_token" text,
        ADD COLUMN IF NOT EXISTS "telegram_link_expires" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "status" = 'active'
      WHERE "role" IN ('admin', 'teacher', 'student')
    `);

    await queryRunner.query(`
      ALTER TABLE "lesson_materials"
        ADD COLUMN IF NOT EXISTS "notes" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lesson_materials" DROP COLUMN IF EXISTS "notes"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "telegram_link_expires",
        DROP COLUMN IF EXISTS "telegram_link_token",
        DROP COLUMN IF EXISTS "telegram_username",
        DROP COLUMN IF EXISTS "verification_code",
        DROP COLUMN IF EXISTS "status"
    `);
  }
}
