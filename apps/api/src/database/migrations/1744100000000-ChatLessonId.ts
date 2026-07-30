import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class ChatLessonId1744100000000 implements MigrationInterface {
  name = 'ChatLessonId1744100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chats
        ADD COLUMN IF NOT EXISTS lesson_id uuid NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_CHATS_LESSON_ID'
        ) THEN
          ALTER TABLE chats
            ADD CONSTRAINT FK_CHATS_LESSON_ID
            FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_CHATS_LESSON_ID
        ON chats (lesson_id)
        WHERE lesson_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS UQ_CHATS_LESSON_ID`);
    await queryRunner.query(`
      ALTER TABLE chats DROP CONSTRAINT IF EXISTS FK_CHATS_LESSON_ID
    `);
    await queryRunner.query(`
      ALTER TABLE chats DROP COLUMN IF EXISTS lesson_id
    `);
  }
}
