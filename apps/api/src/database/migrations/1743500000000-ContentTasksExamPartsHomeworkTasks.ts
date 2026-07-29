import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Content tasks (listening/reading), exam generation parts, homework_tasks mix.
 */
export class ContentTasksExamPartsHomeworkTasks1743500000000
  implements MigrationInterface
{
  name = 'ContentTasksExamPartsHomeworkTasks1743500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_content_tasks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        task_type varchar(32) NOT NULL,
        title text NOT NULL,
        text_content text,
        audio_attachment_id uuid,
        status varchar(32) NOT NULL DEFAULT 'draft',
        created_by_user_id uuid,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_CONTENT_TASKS_STATUS
      ON assessment_content_tasks (status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_CONTENT_TASKS_CREATED_BY
      ON assessment_content_tasks (created_by_user_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_content_task_questions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        content_task_id uuid NOT NULL REFERENCES assessment_content_tasks(id) ON DELETE CASCADE,
        question_id uuid NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_CONTENT_TASK_QUESTIONS_TASK
      ON assessment_content_task_questions (content_task_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_CONTENT_TASK_QUESTIONS_QUESTION
      ON assessment_content_task_questions (question_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_exam_parts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        exam_id uuid NOT NULL REFERENCES assessment_exams(id) ON DELETE CASCADE,
        sort_order int NOT NULL DEFAULT 0,
        part_kind varchar(32) NOT NULL,
        title text,
        select_count int NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_EXAM_PARTS_EXAM
      ON assessment_exam_parts (exam_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_exam_part_pool_items (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        part_id uuid NOT NULL REFERENCES assessment_exam_parts(id) ON DELETE CASCADE,
        question_id uuid REFERENCES assessment_questions(id) ON DELETE CASCADE,
        content_task_id uuid REFERENCES assessment_content_tasks(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT CHK_EXAM_PART_POOL_ONE_REF CHECK (
          (question_id IS NOT NULL AND content_task_id IS NULL)
          OR (question_id IS NULL AND content_task_id IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EXAM_PART_POOL_PART
      ON assessment_exam_part_pool_items (part_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homework_tasks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        homework_id uuid NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
        task_kind varchar(32) NOT NULL,
        sort_order int NOT NULL DEFAULT 0,
        question_id uuid REFERENCES assessment_questions(id) ON DELETE SET NULL,
        content_task_id uuid REFERENCES assessment_content_tasks(id) ON DELETE SET NULL,
        points numeric(10,2),
        created_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT CHK_HOMEWORK_TASK_ONE_REF CHECK (
          (question_id IS NOT NULL AND content_task_id IS NULL)
          OR (question_id IS NULL AND content_task_id IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_TASKS_HOMEWORK
      ON homework_tasks (homework_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS homework_tasks`);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_exam_part_pool_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_exam_parts`);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_content_task_questions`);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_content_tasks`);
  }
}
