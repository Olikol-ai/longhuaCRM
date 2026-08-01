import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

/**
 * Lesson video chats must not appear in the global messenger.
 * - Introduce kind = 'lesson'
 * - Backfill lesson_id from legacy "Чат урока {uuid}" descriptions
 * - Mark legacy "Урок: …" rows as kind=lesson even if lesson_id cannot be recovered
 */
export class LessonChatKindAndBackfill1745200000000 implements MigrationInterface {
  name = 'LessonChatKindAndBackfill1745200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE chats AS c
      SET lesson_id = m.lesson_uuid
      FROM (
        SELECT
          id,
          (substring(description from 'Чат урока ([0-9a-fA-F-]{36})'))::uuid AS lesson_uuid
        FROM chats
        WHERE lesson_id IS NULL
          AND description ~* '^Чат урока [0-9a-fA-F-]{36}'
      ) AS m
      WHERE c.id = m.id
        AND EXISTS (SELECT 1 FROM lessons l WHERE l.id = m.lesson_uuid)
        AND NOT EXISTS (
          SELECT 1 FROM chats other
          WHERE other.lesson_id = m.lesson_uuid
            AND other.id <> m.id
        )
    `);

    await queryRunner.query(`
      UPDATE chats
      SET kind = 'lesson'
      WHERE lesson_id IS NOT NULL
         OR title LIKE 'Урок:%'
         OR description ~* '^Чат урока '
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE chats
      SET kind = 'group'
      WHERE kind = 'lesson'
    `);
  }
}
