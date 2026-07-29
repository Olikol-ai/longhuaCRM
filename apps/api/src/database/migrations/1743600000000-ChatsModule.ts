import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Educational chats: subjects, system/course/direct/group chats, messages, AI stubs.
 */
export class ChatsModule1743600000000 implements MigrationInterface {
  name = 'ChatsModule1743600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_seen_at timestamptz
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name text NOT NULL,
        slug varchar(64) NOT NULL UNIQUE,
        description text,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_subjects (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, subject_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_USER_SUBJECTS_USER ON user_subjects (user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_USER_SUBJECTS_SUBJECT ON user_subjects (subject_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS course_subjects (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        course_template_id uuid NOT NULL REFERENCES course_templates(id) ON DELETE CASCADE,
        subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (course_template_id, subject_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_chat_profiles (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        native_language varchar(64),
        spoken_language varchar(64),
        timezone varchar(64),
        level_label varchar(64),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        kind varchar(32) NOT NULL,
        subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
        course_template_id uuid REFERENCES course_templates(id) ON DELETE SET NULL,
        title text NOT NULL,
        description text,
        status varchar(32) NOT NULL DEFAULT 'active',
        created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_CHATS_KIND ON chats (kind)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_CHATS_STATUS ON chats (status)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_CHATS_SUBJECT_KIND
      ON chats (subject_id) WHERE kind = 'subject' AND subject_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_CHATS_COURSE_KIND
      ON chats (course_template_id) WHERE kind = 'course' AND course_template_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_CHATS_SCHOOL_KIND
      ON chats (kind) WHERE kind IN ('school_news', 'school_community')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_members (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role varchar(32) NOT NULL DEFAULT 'member',
        joined_at timestamptz NOT NULL DEFAULT NOW(),
        last_read_message_id uuid,
        muted_until timestamptz,
        UNIQUE (chat_id, user_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_CHAT_MEMBERS_USER ON chat_members (user_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_direct_pairs (
        user_id_low uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_id_high uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id_low, user_id_high),
        UNIQUE (chat_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        sender_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        type varchar(32) NOT NULL DEFAULT 'text',
        body text,
        reply_to_message_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
        ref_entity_type varchar(32),
        ref_entity_id uuid,
        edited_at timestamptz,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_CHAT_MESSAGES_CHAT_CREATED
      ON chat_messages (chat_id, created_at DESC)
    `);

    await queryRunner.query(`
      ALTER TABLE chat_members
      ADD CONSTRAINT FK_CHAT_MEMBERS_LAST_READ
      FOREIGN KEY (last_read_message_id) REFERENCES chat_messages(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_attachments (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
        kind varchar(32) NOT NULL,
        storage_key text NOT NULL,
        mime varchar(128),
        original_filename text,
        size_bytes bigint,
        duration_ms int,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_CHAT_ATTACHMENTS_MESSAGE
      ON chat_attachments (message_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_voice_messages (
        attachment_id uuid PRIMARY KEY REFERENCES chat_attachments(id) ON DELETE CASCADE,
        duration_ms int NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_read_receipts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        read_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (message_id, user_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_pinned_messages (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
        pinned_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        pinned_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (chat_id, message_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_message_reactions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji varchar(32) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (message_id, user_id, emoji)
      )
    `);

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

    // Seed subject + school chats
    await queryRunner.query(`
      INSERT INTO subjects (id, name, slug, description)
      SELECT uuid_generate_v4(), 'Китайский язык', 'chinese', 'Основной предмет Longhua Academy'
      WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE slug = 'chinese')
    `);

    await queryRunner.query(`
      INSERT INTO chats (id, kind, title, description, status)
      SELECT uuid_generate_v4(), 'school_news', 'Новости Longhua', 'Объявления администрации', 'active'
      WHERE NOT EXISTS (SELECT 1 FROM chats WHERE kind = 'school_news')
    `);
    await queryRunner.query(`
      INSERT INTO chats (id, kind, title, description, status)
      SELECT uuid_generate_v4(), 'school_community', 'Сообщество Longhua', 'Общий чат школы', 'active'
      WHERE NOT EXISTS (SELECT 1 FROM chats WHERE kind = 'school_community')
    `);

    await queryRunner.query(`
      INSERT INTO chats (id, kind, subject_id, title, description, status)
      SELECT uuid_generate_v4(), 'subject', s.id, s.name, 'Системный чат предмета', 'active'
      FROM subjects s
      WHERE s.slug = 'chinese'
        AND NOT EXISTS (
          SELECT 1 FROM chats c WHERE c.kind = 'subject' AND c.subject_id = s.id
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_conversation_turns`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_conversations`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_message_reactions`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_pinned_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_read_receipts`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_voice_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_attachments`);
    await queryRunner.query(`
      ALTER TABLE chat_members DROP CONSTRAINT IF EXISTS FK_CHAT_MEMBERS_LAST_READ
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_direct_pairs`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS chats`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_chat_profiles`);
    await queryRunner.query(`DROP TABLE IF EXISTS course_subjects`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_subjects`);
    await queryRunner.query(`DROP TABLE IF EXISTS subjects`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS last_seen_at`);
  }
}
