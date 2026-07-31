import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add chat_members.last_read_at and repair stuck unread cursors.
 *
 * Root cause of sticky badges: TypeORM save() with a loaded lastReadMessage
 * relation did not persist last_read_message_id advances, while read receipts
 * for the viewed messages were still inserted. Rebuild cursors from receipts.
 */
export class ChatMemberLastReadAtAndUnreadRepair1744700000000 implements MigrationInterface {
  name = 'ChatMemberLastReadAtAndUnreadRepair1744700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chat_members
      ADD COLUMN IF NOT EXISTS last_read_at timestamptz NULL
    `);

    // Backfill last_read_at from the current cursor message.
    await queryRunner.query(`
      UPDATE chat_members cm
      SET last_read_at = msg.created_at
      FROM chat_messages msg
      WHERE cm.last_read_message_id = msg.id
        AND (cm.last_read_at IS NULL OR cm.last_read_at IS DISTINCT FROM msg.created_at)
    `);

    // Advance cursor to the newest message the user already receipted.
    // Fixes members whose receipts moved ahead of last_read_message_id
    // after failed TypeORM relation saves.
    await queryRunner.query(`
      UPDATE chat_members cm
      SET
        last_read_message_id = latest.message_id,
        last_read_at = latest.created_at
      FROM (
        SELECT DISTINCT ON (r.user_id, m.chat_id)
          r.user_id,
          m.chat_id,
          m.id AS message_id,
          m.created_at
        FROM chat_read_receipts r
        INNER JOIN chat_messages m ON m.id = r.message_id
        WHERE m.deleted_at IS NULL
        ORDER BY r.user_id, m.chat_id, m.created_at DESC, m.id DESC
      ) latest
      WHERE cm.user_id = latest.user_id
        AND cm.chat_id = latest.chat_id
        AND (
          cm.last_read_message_id IS DISTINCT FROM latest.message_id
          OR cm.last_read_at IS DISTINCT FROM latest.created_at
        )
    `);

    // Drop orphaned receipts without a user or message (defensive cleanup).
    await queryRunner.query(`
      DELETE FROM chat_read_receipts r
      WHERE r.user_id IS NULL
         OR r.message_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id)
         OR NOT EXISTS (SELECT 1 FROM chat_messages m WHERE m.id = r.message_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chat_members
      DROP COLUMN IF EXISTS last_read_at
    `);
  }
}
