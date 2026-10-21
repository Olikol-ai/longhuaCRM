import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two-layer exam result score:
 * - score — canonical final (student/teacher/percent/passed)
 * - auto_score — automatic sum of question scores (nullable for legacy)
 * - score_source — auto | manual
 *
 * Does NOT backfill auto_score from score: pre-migration rows may already
 * have been edited outside this model, so inventing an "original" auto total
 * would be dishonest.
 */
export class AssessmentResultFinalScore1747400000000
  implements MigrationInterface
{
  name = 'AssessmentResultFinalScore1747400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE assessment_results
        ADD COLUMN IF NOT EXISTS auto_score numeric(10, 2) NULL,
        ADD COLUMN IF NOT EXISTS score_source varchar(16) NOT NULL DEFAULT 'auto'
    `);
    await queryRunner.query(`
      UPDATE assessment_results
      SET score_source = 'auto'
      WHERE score_source IS NULL OR score_source = ''
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'CHK_ASSESSMENT_RESULTS_SCORE_SOURCE'
        ) THEN
          ALTER TABLE assessment_results
            ADD CONSTRAINT "CHK_ASSESSMENT_RESULTS_SCORE_SOURCE"
            CHECK (score_source IN ('auto', 'manual'));
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE assessment_results
        DROP CONSTRAINT IF EXISTS "CHK_ASSESSMENT_RESULTS_SCORE_SOURCE"
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_results
        DROP COLUMN IF EXISTS score_source,
        DROP COLUMN IF EXISTS auto_score
    `);
  }
}
