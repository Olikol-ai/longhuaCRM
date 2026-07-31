import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vocabulary ("новые слова") for Reading/Listening tasks + attempt snapshots.
 * Not part of the question bank — owned by the task only.
 */
export class ReadingListeningTaskVocabulary1744600000000 implements MigrationInterface {
  name = 'ReadingListeningTaskVocabulary1744600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_reading_task_vocabulary (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        reading_task_id uuid NOT NULL
          REFERENCES assessment_reading_tasks(id) ON DELETE CASCADE,
        word text NOT NULL,
        pinyin text,
        translation text,
        explanation text,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_READING_TASK_VOCAB_TASK
      ON assessment_reading_task_vocabulary (reading_task_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_listening_task_vocabulary (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        listening_task_id uuid NOT NULL
          REFERENCES assessment_listening_tasks(id) ON DELETE CASCADE,
        word text NOT NULL,
        pinyin text,
        translation text,
        explanation text,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_LISTENING_TASK_VOCAB_TASK
      ON assessment_listening_task_vocabulary (listening_task_id)
    `);

    await queryRunner.query(`
      ALTER TABLE assessment_question_snapshots
      ADD COLUMN IF NOT EXISTS passage_text text,
      ADD COLUMN IF NOT EXISTS task_instructions text
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_question_snapshot_vocabulary (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        question_snapshot_id uuid NOT NULL
          REFERENCES assessment_question_snapshots(id) ON DELETE CASCADE,
        word text NOT NULL,
        pinyin text,
        translation text,
        explanation text,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_QSNAP_VOCAB_SNAP
      ON assessment_question_snapshot_vocabulary (question_snapshot_id)
    `);

    await queryRunner.query(`
      ALTER TABLE homework_items
      ADD COLUMN IF NOT EXISTS task_instructions text
    `);
    await queryRunner.query(`
      ALTER TABLE homework_question_snapshots
      ADD COLUMN IF NOT EXISTS task_instructions text
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homework_question_snapshot_vocabulary (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        question_snapshot_id uuid NOT NULL
          REFERENCES homework_question_snapshots(id) ON DELETE CASCADE,
        word text NOT NULL,
        pinyin text,
        translation text,
        explanation text,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_QSNAP_VOCAB_SNAP
      ON homework_question_snapshot_vocabulary (question_snapshot_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS homework_question_snapshot_vocabulary`);
    await queryRunner.query(`
      ALTER TABLE homework_question_snapshots DROP COLUMN IF EXISTS task_instructions
    `);
    await queryRunner.query(`
      ALTER TABLE homework_items DROP COLUMN IF EXISTS task_instructions
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_question_snapshot_vocabulary`);
    await queryRunner.query(`
      ALTER TABLE assessment_question_snapshots
      DROP COLUMN IF EXISTS passage_text,
      DROP COLUMN IF EXISTS task_instructions
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_listening_task_vocabulary`);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_reading_task_vocabulary`);
  }
}
