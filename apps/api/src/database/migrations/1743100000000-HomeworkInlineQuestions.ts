import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Homework questions become self-contained on homework_items.
 * No dependency on assessment_questions / ExamBlock for new homework.
 * Existing items are backfilled from assessment_questions when present.
 */
export class HomeworkInlineQuestions1743100000000 implements MigrationInterface {
  name = 'HomeworkInlineQuestions1743100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE homework_items
        ADD COLUMN IF NOT EXISTS type varchar(32),
        ADD COLUMN IF NOT EXISTS stem text,
        ADD COLUMN IF NOT EXISTS difficulty int NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS explanation text
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homework_item_answers (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        homework_item_id uuid NOT NULL REFERENCES homework_items(id) ON DELETE CASCADE,
        body text NOT NULL,
        is_correct boolean NOT NULL DEFAULT false,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_ITEM_ANSWERS_ITEM
      ON homework_item_answers (homework_item_id)
    `);

    await queryRunner.query(`
      UPDATE homework_items hi
      SET
        type = aq.type,
        stem = aq.stem,
        difficulty = aq.difficulty,
        explanation = aq.explanation,
        points = COALESCE(hi.points, aq.points)
      FROM assessment_questions aq
      WHERE hi.question_id = aq.id
        AND (hi.type IS NULL OR hi.stem IS NULL)
    `);

    await queryRunner.query(`
      INSERT INTO homework_item_answers (id, homework_item_id, body, is_correct, sort_order)
      SELECT
        uuid_generate_v4(),
        hi.id,
        aa.text,
        aa.is_correct,
        aa.sort_order
      FROM homework_items hi
      INNER JOIN assessment_answers aa ON aa.question_id = hi.question_id
      WHERE NOT EXISTS (
        SELECT 1 FROM homework_item_answers hia WHERE hia.homework_item_id = hi.id
      )
    `);

    await queryRunner.query(`
      UPDATE homework_items
      SET
        type = COALESCE(type, 'single_choice'),
        stem = COALESCE(NULLIF(trim(stem), ''), 'Вопрос')
      WHERE type IS NULL OR stem IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE homework_items
        ALTER COLUMN type SET NOT NULL,
        ALTER COLUMN stem SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE homework_items
        DROP CONSTRAINT IF EXISTS homework_items_question_id_fkey
    `);
    await queryRunner.query(`
      ALTER TABLE homework_items
        ALTER COLUMN question_id DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE homework_items
        ADD CONSTRAINT homework_items_question_id_fkey
        FOREIGN KEY (question_id) REFERENCES assessment_questions(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE homework_items
      SET question_id = COALESCE(
        question_id,
        (SELECT id FROM assessment_questions ORDER BY created_at ASC LIMIT 1)
      )
      WHERE question_id IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE homework_items
        ALTER COLUMN question_id SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE homework_items
        ADD CONSTRAINT homework_items_question_id_fkey
        FOREIGN KEY (question_id) REFERENCES assessment_questions(id) ON DELETE RESTRICT
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS homework_item_answers`);

    await queryRunner.query(`
      ALTER TABLE homework_items
        DROP COLUMN IF EXISTS type,
        DROP COLUMN IF EXISTS stem,
        DROP COLUMN IF EXISTS difficulty,
        DROP COLUMN IF EXISTS explanation
    `);
  }
}
