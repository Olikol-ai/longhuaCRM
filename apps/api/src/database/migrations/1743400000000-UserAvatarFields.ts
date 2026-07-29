import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAvatarFields1743400000000 implements MigrationInterface {
  name = 'UserAvatarFields1743400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "avatar_file_path" text,
        ADD COLUMN IF NOT EXISTS "avatar_thumb_path" text,
        ADD COLUMN IF NOT EXISTS "avatar_updated_at" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "avatar_updated_at",
        DROP COLUMN IF EXISTS "avatar_thumb_path",
        DROP COLUMN IF EXISTS "avatar_file_path"
    `);
  }
}
