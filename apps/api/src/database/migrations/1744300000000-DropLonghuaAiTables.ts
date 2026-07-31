import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

/**
 * Removes Longhua AI conversation tables and leftover AI chat messages.
 * AI features are retired from this CRM version.
 */
export class DropLonghuaAiTables1744300000000 implements MigrationInterface {
  name = 'DropLonghuaAiTables1744300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_conversation_turns`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_conversations`);
    await queryRunner.query(
      `DELETE FROM chat_messages WHERE type = 'ai_response'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider varchar(64) NOT NULL DEFAULT 'mock',
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_conversation_turns (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
        role varchar(32) NOT NULL,
        message_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
        content text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
  }
}
