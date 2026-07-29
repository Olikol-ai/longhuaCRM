import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drop legacy ContentTask tables after Reading/Listening split.
 * Data was migrated in SplitReadingListeningTasks1743800000000.
 */
export class DropAssessmentContentTasks1744000000000 implements MigrationInterface {
  name = 'DropAssessmentContentTasks1744000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE assessment_exam_part_pool_items
      DROP CONSTRAINT IF EXISTS CHK_EXAM_PART_POOL_ONE_REF
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_exam_part_pool_items
      DROP COLUMN IF EXISTS content_task_id
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_exam_part_pool_items
      ADD CONSTRAINT CHK_EXAM_PART_POOL_ONE_REF CHECK (
        (question_id IS NOT NULL AND reading_task_id IS NULL AND listening_task_id IS NULL)
        OR (question_id IS NULL AND reading_task_id IS NOT NULL AND listening_task_id IS NULL)
        OR (question_id IS NULL AND reading_task_id IS NULL AND listening_task_id IS NOT NULL)
      )
    `);

    await queryRunner.query(`
      ALTER TABLE homework_tasks
      DROP CONSTRAINT IF EXISTS CHK_HOMEWORK_TASK_ONE_REF
    `);
    await queryRunner.query(`
      ALTER TABLE homework_tasks
      DROP COLUMN IF EXISTS content_task_id
    `);
    await queryRunner.query(`
      ALTER TABLE homework_tasks
      ADD CONSTRAINT CHK_HOMEWORK_TASK_ONE_REF CHECK (
        (question_id IS NOT NULL AND reading_task_id IS NULL AND listening_task_id IS NULL)
        OR (question_id IS NULL AND reading_task_id IS NOT NULL AND listening_task_id IS NULL)
        OR (question_id IS NULL AND reading_task_id IS NULL AND listening_task_id IS NOT NULL)
      )
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS assessment_content_task_questions`);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_content_tasks`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_content_tasks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        task_type varchar(32) NOT NULL,
        title varchar(500) NOT NULL,
        text_content text NULL,
        audio_attachment_id uuid NULL,
        status varchar(32) NOT NULL DEFAULT 'draft',
        created_by_user_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_content_task_questions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        content_task_id uuid NOT NULL REFERENCES assessment_content_tasks(id) ON DELETE CASCADE,
        question_id uuid NOT NULL,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE homework_tasks
      DROP CONSTRAINT IF EXISTS CHK_HOMEWORK_TASK_ONE_REF
    `);
    await queryRunner.query(`
      ALTER TABLE homework_tasks
      ADD COLUMN IF NOT EXISTS content_task_id uuid NULL
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

    await queryRunner.query(`
      ALTER TABLE assessment_exam_part_pool_items
      DROP CONSTRAINT IF EXISTS CHK_EXAM_PART_POOL_ONE_REF
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_exam_part_pool_items
      ADD COLUMN IF NOT EXISTS content_task_id uuid NULL
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
  }
}
