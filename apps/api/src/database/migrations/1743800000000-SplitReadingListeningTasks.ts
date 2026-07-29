import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Split Listening/Reading into owned task→question tables (no shared bank linking).
 * Migrates assessment_content_tasks data, rewires exam/homework FKs, archives linked bank questions.
 */
export class SplitReadingListeningTasks1743800000000 implements MigrationInterface {
  name = 'SplitReadingListeningTasks1743800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_reading_tasks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        title text NOT NULL,
        text_content text NOT NULL DEFAULT '',
        instructions text,
        level_label varchar(64),
        status varchar(32) NOT NULL DEFAULT 'draft',
        created_by_user_id uuid,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_READING_TASKS_STATUS
      ON assessment_reading_tasks (status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_READING_TASKS_CREATED_BY
      ON assessment_reading_tasks (created_by_user_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_reading_questions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        reading_task_id uuid NOT NULL REFERENCES assessment_reading_tasks(id) ON DELETE CASCADE,
        sort_order int NOT NULL DEFAULT 0,
        type varchar(32) NOT NULL,
        stem text NOT NULL,
        points numeric(10,2) NOT NULL DEFAULT 1,
        explanation text,
        status varchar(32) NOT NULL DEFAULT 'draft',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_READING_QUESTIONS_TASK
      ON assessment_reading_questions (reading_task_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_reading_question_answers (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        reading_question_id uuid NOT NULL REFERENCES assessment_reading_questions(id) ON DELETE CASCADE,
        text text NOT NULL,
        is_correct boolean NOT NULL DEFAULT false,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_READING_QUESTION_ANSWERS_QUESTION
      ON assessment_reading_question_answers (reading_question_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_listening_tasks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        title text NOT NULL,
        instructions text,
        level_label varchar(64),
        audio_storage_key text,
        audio_mime varchar(128),
        audio_original_filename text,
        status varchar(32) NOT NULL DEFAULT 'draft',
        created_by_user_id uuid,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_LISTENING_TASKS_STATUS
      ON assessment_listening_tasks (status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_LISTENING_TASKS_CREATED_BY
      ON assessment_listening_tasks (created_by_user_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_listening_questions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        listening_task_id uuid NOT NULL REFERENCES assessment_listening_tasks(id) ON DELETE CASCADE,
        sort_order int NOT NULL DEFAULT 0,
        type varchar(32) NOT NULL,
        stem text NOT NULL,
        points numeric(10,2) NOT NULL DEFAULT 1,
        explanation text,
        status varchar(32) NOT NULL DEFAULT 'draft',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_LISTENING_QUESTIONS_TASK
      ON assessment_listening_questions (listening_task_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_listening_question_answers (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        listening_question_id uuid NOT NULL REFERENCES assessment_listening_questions(id) ON DELETE CASCADE,
        text text NOT NULL,
        is_correct boolean NOT NULL DEFAULT false,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_LISTENING_QUESTION_ANSWERS_QUESTION
      ON assessment_listening_question_answers (listening_question_id)
    `);

    // Map old content_task id → new reading/listening task id
    await queryRunner.query(`
      CREATE TEMP TABLE tmp_content_task_map (
        old_id uuid PRIMARY KEY,
        task_type varchar(32) NOT NULL,
        new_id uuid NOT NULL
      ) ON COMMIT DROP
    `);

    await queryRunner.query(`
      INSERT INTO assessment_reading_tasks (
        id, title, text_content, instructions, status, created_by_user_id, created_at, updated_at
      )
      SELECT
        ct.id,
        ct.title,
        COALESCE(ct.text_content, ''),
        NULL,
        ct.status,
        ct.created_by_user_id,
        ct.created_at,
        ct.updated_at
      FROM assessment_content_tasks ct
      WHERE ct.task_type = 'reading'
        AND NOT EXISTS (SELECT 1 FROM assessment_reading_tasks r WHERE r.id = ct.id)
    `);

    await queryRunner.query(`
      INSERT INTO tmp_content_task_map (old_id, task_type, new_id)
      SELECT id, 'reading', id FROM assessment_content_tasks WHERE task_type = 'reading'
    `);

    await queryRunner.query(`
      INSERT INTO assessment_listening_tasks (
        id, title, instructions, status, created_by_user_id,
        audio_storage_key, audio_mime, audio_original_filename,
        created_at, updated_at
      )
      SELECT
        ct.id,
        ct.title,
        NULL,
        ct.status,
        ct.created_by_user_id,
        att.storage_key,
        att.mime,
        att.original_filename,
        ct.created_at,
        ct.updated_at
      FROM assessment_content_tasks ct
      LEFT JOIN assessment_question_attachments att ON att.id = ct.audio_attachment_id
      WHERE ct.task_type = 'listening'
        AND NOT EXISTS (SELECT 1 FROM assessment_listening_tasks l WHERE l.id = ct.id)
    `);

    await queryRunner.query(`
      INSERT INTO tmp_content_task_map (old_id, task_type, new_id)
      SELECT id, 'listening', id FROM assessment_content_tasks WHERE task_type = 'listening'
      ON CONFLICT (old_id) DO NOTHING
    `);

    // Copy nested bank questions into owned reading questions
    await queryRunner.query(`
      INSERT INTO assessment_reading_questions (
        id, reading_task_id, sort_order, type, stem, points, explanation, status, created_at, updated_at
      )
      SELECT
        link.question_id,
        link.content_task_id,
        link.sort_order,
        q.type,
        q.stem,
        q.points,
        q.explanation,
        q.status,
        link.created_at,
        NOW()
      FROM assessment_content_task_questions link
      INNER JOIN assessment_content_tasks ct ON ct.id = link.content_task_id AND ct.task_type = 'reading'
      INNER JOIN assessment_questions q ON q.id = link.question_id
      WHERE NOT EXISTS (
        SELECT 1 FROM assessment_reading_questions rq WHERE rq.id = link.question_id
      )
    `);

    await queryRunner.query(`
      INSERT INTO assessment_reading_question_answers (
        id, reading_question_id, text, is_correct, sort_order, created_at, updated_at
      )
      SELECT
        a.id, a.question_id, a.text, a.is_correct, a.sort_order, a.created_at, a.updated_at
      FROM assessment_answers a
      INNER JOIN assessment_reading_questions rq ON rq.id = a.question_id
      WHERE NOT EXISTS (
        SELECT 1 FROM assessment_reading_question_answers ra WHERE ra.id = a.id
      )
    `);

    await queryRunner.query(`
      INSERT INTO assessment_listening_questions (
        id, listening_task_id, sort_order, type, stem, points, explanation, status, created_at, updated_at
      )
      SELECT
        link.question_id,
        link.content_task_id,
        link.sort_order,
        q.type,
        q.stem,
        q.points,
        q.explanation,
        q.status,
        link.created_at,
        NOW()
      FROM assessment_content_task_questions link
      INNER JOIN assessment_content_tasks ct ON ct.id = link.content_task_id AND ct.task_type = 'listening'
      INNER JOIN assessment_questions q ON q.id = link.question_id
      WHERE NOT EXISTS (
        SELECT 1 FROM assessment_listening_questions lq WHERE lq.id = link.question_id
      )
    `);

    await queryRunner.query(`
      INSERT INTO assessment_listening_question_answers (
        id, listening_question_id, text, is_correct, sort_order, created_at, updated_at
      )
      SELECT
        a.id, a.question_id, a.text, a.is_correct, a.sort_order, a.created_at, a.updated_at
      FROM assessment_answers a
      INNER JOIN assessment_listening_questions lq ON lq.id = a.question_id
      WHERE NOT EXISTS (
        SELECT 1 FROM assessment_listening_question_answers la WHERE la.id = a.id
      )
    `);

    // Archive bank questions that were only used inside content tasks
    await queryRunner.query(`
      UPDATE assessment_questions q
      SET status = 'archived'
      WHERE q.id IN (
        SELECT DISTINCT link.question_id
        FROM assessment_content_task_questions link
      )
      AND q.type IN ('single_choice', 'multiple_choice', 'short_text', 'translation', 'listening', 'reading')
    `);

    // Exam pool: add new FK columns
    await queryRunner.query(`
      ALTER TABLE assessment_exam_part_pool_items
      ADD COLUMN IF NOT EXISTS reading_task_id uuid REFERENCES assessment_reading_tasks(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_exam_part_pool_items
      ADD COLUMN IF NOT EXISTS listening_task_id uuid REFERENCES assessment_listening_tasks(id) ON DELETE CASCADE
    `);

    await queryRunner.query(`
      UPDATE assessment_exam_part_pool_items p
      SET reading_task_id = p.content_task_id,
          content_task_id = NULL
      FROM assessment_content_tasks ct
      WHERE p.content_task_id = ct.id AND ct.task_type = 'reading'
    `);
    await queryRunner.query(`
      UPDATE assessment_exam_part_pool_items p
      SET listening_task_id = p.content_task_id,
          content_task_id = NULL
      FROM assessment_content_tasks ct
      WHERE p.content_task_id = ct.id AND ct.task_type = 'listening'
    `);

    await queryRunner.query(`
      ALTER TABLE assessment_exam_part_pool_items
      DROP CONSTRAINT IF EXISTS CHK_EXAM_PART_POOL_ONE_REF
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_exam_part_pool_items
      ADD CONSTRAINT CHK_EXAM_PART_POOL_ONE_REF CHECK (
        (question_id IS NOT NULL AND reading_task_id IS NULL AND listening_task_id IS NULL AND content_task_id IS NULL)
        OR (question_id IS NULL AND reading_task_id IS NOT NULL AND listening_task_id IS NULL AND content_task_id IS NULL)
        OR (question_id IS NULL AND reading_task_id IS NULL AND listening_task_id IS NOT NULL AND content_task_id IS NULL)
        OR (question_id IS NULL AND reading_task_id IS NULL AND listening_task_id IS NULL AND content_task_id IS NOT NULL)
      )
    `);

    // Homework tasks
    await queryRunner.query(`
      ALTER TABLE homework_tasks
      ADD COLUMN IF NOT EXISTS reading_task_id uuid REFERENCES assessment_reading_tasks(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE homework_tasks
      ADD COLUMN IF NOT EXISTS listening_task_id uuid REFERENCES assessment_listening_tasks(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      UPDATE homework_tasks h
      SET reading_task_id = h.content_task_id,
          content_task_id = NULL
      FROM assessment_content_tasks ct
      WHERE h.content_task_id = ct.id AND ct.task_type = 'reading'
    `);
    await queryRunner.query(`
      UPDATE homework_tasks h
      SET listening_task_id = h.content_task_id,
          content_task_id = NULL
      FROM assessment_content_tasks ct
      WHERE h.content_task_id = ct.id AND ct.task_type = 'listening'
    `);

    await queryRunner.query(`
      ALTER TABLE homework_tasks
      DROP CONSTRAINT IF EXISTS CHK_HOMEWORK_TASK_ONE_REF
    `);
    await queryRunner.query(`
      ALTER TABLE homework_tasks
      ADD CONSTRAINT CHK_HOMEWORK_TASK_ONE_REF CHECK (
        (question_id IS NOT NULL AND reading_task_id IS NULL AND listening_task_id IS NULL AND content_task_id IS NULL)
        OR (question_id IS NULL AND reading_task_id IS NOT NULL AND listening_task_id IS NULL AND content_task_id IS NULL)
        OR (question_id IS NULL AND reading_task_id IS NULL AND listening_task_id IS NOT NULL AND content_task_id IS NULL)
        OR (question_id IS NULL AND reading_task_id IS NULL AND listening_task_id IS NULL AND content_task_id IS NOT NULL)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE homework_tasks DROP CONSTRAINT IF EXISTS CHK_HOMEWORK_TASK_ONE_REF
    `);
    await queryRunner.query(`ALTER TABLE homework_tasks DROP COLUMN IF EXISTS reading_task_id`);
    await queryRunner.query(`ALTER TABLE homework_tasks DROP COLUMN IF EXISTS listening_task_id`);
    await queryRunner.query(`
      ALTER TABLE assessment_exam_part_pool_items DROP CONSTRAINT IF EXISTS CHK_EXAM_PART_POOL_ONE_REF
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_exam_part_pool_items DROP COLUMN IF EXISTS reading_task_id
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_exam_part_pool_items DROP COLUMN IF EXISTS listening_task_id
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_listening_question_answers`);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_listening_questions`);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_listening_tasks`);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_reading_question_answers`);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_reading_questions`);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_reading_tasks`);
  }
}
