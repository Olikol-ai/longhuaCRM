import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remove Question Bank layer.
 * Question becomes standalone with created_by_user_id ownership.
 * Hierarchy: Question → ExamBlock → Exam.
 */
export class DropAssessmentBanks1743000000000 implements MigrationInterface {
  name = 'DropAssessmentBanks1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE assessment_questions q
      SET created_by_user_id = b.created_by_user_id
      FROM assessment_banks b
      WHERE q.bank_id = b.id
        AND q.created_by_user_id IS NULL
        AND b.created_by_user_id IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE assessment_questions
      DROP CONSTRAINT IF EXISTS "FK_assessment_questions_bank_id"
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_questions
      DROP CONSTRAINT IF EXISTS "assessment_questions_bank_id_fkey"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_ASSESSMENT_QUESTIONS_BANK_ID"
    `);

    await queryRunner.query(`
      ALTER TABLE assessment_questions
      DROP COLUMN IF EXISTS bank_id
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS assessment_banks
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "assessment_banks" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "description" text,
        "locale" varchar(16),
        "status" varchar(32) NOT NULL DEFAULT 'draft',
        "created_by_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE assessment_questions
      ADD COLUMN IF NOT EXISTS bank_id uuid
    `);

    await queryRunner.query(`
      INSERT INTO assessment_banks (id, name, description, status, created_by_user_id)
      SELECT
        uuid_generate_v4(),
        'Migrated bank for ' || COALESCE(u.email, q.created_by_user_id::text, 'unknown'),
        'Restored by DropAssessmentBanks down()',
        'published',
        q.created_by_user_id
      FROM (
        SELECT DISTINCT created_by_user_id FROM assessment_questions
      ) q
      LEFT JOIN users u ON u.id = q.created_by_user_id
      WHERE NOT EXISTS (
        SELECT 1 FROM assessment_banks b WHERE b.created_by_user_id IS NOT DISTINCT FROM q.created_by_user_id
      )
    `);

    await queryRunner.query(`
      UPDATE assessment_questions q
      SET bank_id = b.id
      FROM assessment_banks b
      WHERE q.bank_id IS NULL
        AND b.created_by_user_id IS NOT DISTINCT FROM q.created_by_user_id
    `);

    await queryRunner.query(`
      INSERT INTO assessment_banks (id, name, status)
      SELECT uuid_generate_v4(), 'Orphan restored bank', 'published'
      WHERE EXISTS (SELECT 1 FROM assessment_questions WHERE bank_id IS NULL)
        AND NOT EXISTS (SELECT 1 FROM assessment_banks WHERE name = 'Orphan restored bank')
    `);

    await queryRunner.query(`
      UPDATE assessment_questions
      SET bank_id = (SELECT id FROM assessment_banks WHERE name = 'Orphan restored bank' LIMIT 1)
      WHERE bank_id IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE assessment_questions
      ALTER COLUMN bank_id SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE assessment_questions
      ADD CONSTRAINT "assessment_questions_bank_id_fkey"
      FOREIGN KEY (bank_id) REFERENCES assessment_banks(id) ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ASSESSMENT_QUESTIONS_BANK_ID"
      ON assessment_questions (bank_id)
    `);
  }
}
