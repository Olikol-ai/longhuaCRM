import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DM requests, privacy settings, block list, and personal chat hide (hidden_at).
 */
export class ChatPrivacyAndDmRequests1743900000000 implements MigrationInterface {
  name = 'ChatPrivacyAndDmRequests1743900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS direct_chat_requests (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status varchar(32) NOT NULL DEFAULT 'pending',
        message text,
        responded_at timestamptz,
        expires_at timestamptz,
        created_chat_id uuid REFERENCES chats(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_DIRECT_CHAT_REQUESTS_TO_STATUS
      ON direct_chat_requests (to_user_id, status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_DIRECT_CHAT_REQUESTS_FROM_STATUS
      ON direct_chat_requests (from_user_id, status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_DIRECT_CHAT_REQUESTS_PAIR_CREATED
      ON direct_chat_requests (from_user_id, to_user_id, created_at)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_DIRECT_CHAT_REQUESTS_PENDING_PAIR
      ON direct_chat_requests (from_user_id, to_user_id)
      WHERE status = 'pending'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_privacy_settings (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        dm_policy varchar(64) NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_blocks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        blocker_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT UQ_USER_BLOCKS_PAIR UNIQUE (blocker_user_id, blocked_user_id),
        CONSTRAINT CHK_USER_BLOCKS_NOT_SELF CHECK (blocker_user_id <> blocked_user_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_USER_BLOCKS_BLOCKER
      ON user_blocks (blocker_user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_USER_BLOCKS_BLOCKED
      ON user_blocks (blocked_user_id)
    `);

    await queryRunner.query(`
      ALTER TABLE chat_members
      ADD COLUMN IF NOT EXISTS hidden_at timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE chat_members DROP COLUMN IF EXISTS hidden_at`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_blocks`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_privacy_settings`);
    await queryRunner.query(`DROP TABLE IF EXISTS direct_chat_requests`);
  }
}
