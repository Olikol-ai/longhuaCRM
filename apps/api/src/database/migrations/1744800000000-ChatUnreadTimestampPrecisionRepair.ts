import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repair read receipts skipped by JS Date microsecond truncation.
 * When last_read pointed at message …722391 but receipts used Date(…722),
 * the cursor message itself was never receipted.
 */
export class ChatUnreadTimestampPrecisionRepair1744800000000 implements MigrationInterface {
  name = 'ChatUnreadTimestampPrecisionRepair1744800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO chat_read_receipts (id, message_id, user_id, read_at)
      SELECT uuid_generate_v4(), msg.id, cm.user_id, NOW()
      FROM chat_members cm
      INNER JOIN chat_messages cursor
        ON cursor.id = cm.last_read_message_id
      INNER JOIN chat_messages msg
        ON msg.chat_id = cm.chat_id
       AND msg.deleted_at IS NULL
       AND (msg.created_at, msg.id) <= (cursor.created_at, cursor.id)
      WHERE cm.last_read_message_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM chat_read_receipts r
          WHERE r.message_id = msg.id AND r.user_id = cm.user_id
        )
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Irreversible data repair
  }
}
