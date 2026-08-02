import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Partition Assessment question bank vs HSK Exam Content engine questions.
 */
export class AssessmentQuestionBankScope1745500000000 implements MigrationInterface {
  name = 'AssessmentQuestionBankScope1745500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE assessment_questions
      ADD COLUMN IF NOT EXISTS bank_scope varchar(32) NOT NULL DEFAULT 'assessment'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_QUESTIONS_BANK_SCOPE
      ON assessment_questions (bank_scope)
    `);
    await queryRunner.query(`
      UPDATE assessment_questions q
      SET bank_scope = 'exam_content'
      WHERE EXISTS (
        SELECT 1 FROM exam_content_items i WHERE i.engine_content_id = q.id
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS IDX_ASSESSMENT_QUESTIONS_BANK_SCOPE
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_questions DROP COLUMN IF EXISTS bank_scope
    `);
  }
}
