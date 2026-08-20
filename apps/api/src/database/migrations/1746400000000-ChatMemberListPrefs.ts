import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-user chat list prefs on chat_members (USER+CHAT SSOT).
 * Archive/pin/favorite must sync across devices — not localStorage.
 * muted_until already existed; archived/pinned/favorite are additive.
 */
export class ChatMemberListPrefs1746400000000 implements MigrationInterface {
  name = 'ChatMemberListPrefs1746400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chat_members
      ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL
    `);
    await queryRunner.query(`
      ALTER TABLE chat_members
      ADD COLUMN IF NOT EXISTS pinned_at timestamptz NULL
    `);
    await queryRunner.query(`
      ALTER TABLE chat_members
      ADD COLUMN IF NOT EXISTS favorited_at timestamptz NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_CHAT_MEMBERS_USER_ARCHIVED
      ON chat_members (user_id, archived_at)
      WHERE archived_at IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_CHAT_MEMBERS_USER_PINNED
      ON chat_members (user_id, pinned_at)
      WHERE pinned_at IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_CHAT_MEMBERS_USER_PINNED`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_CHAT_MEMBERS_USER_ARCHIVED`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_members DROP COLUMN IF EXISTS favorited_at`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_members DROP COLUMN IF EXISTS pinned_at`,
    );
    await queryRunner.query(
      `ALTER TABLE chat_members DROP COLUMN IF EXISTS archived_at`,
    );
  }
}
