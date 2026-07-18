import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Teacher manual review metadata on attempt answers.
 * Does not alter Result/Attempt lifecycle columns.
 */
export class AssessmentAnswerReviewMeta1740700000000 implements MigrationInterface {
  name = 'AssessmentAnswerReviewMeta1740700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assessment_attempt_answers"
      ADD COLUMN IF NOT EXISTS "review_comment" text
    `);

    await queryRunner.query(`
      ALTER TABLE "assessment_attempt_answers"
      ADD COLUMN IF NOT EXISTS "reviewed_by_user_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "assessment_attempt_answers"
      ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ASSESSMENT_ATTEMPT_ANSWERS_REVIEWED_BY"
      ON "assessment_attempt_answers" ("reviewed_by_user_id")
      WHERE "reviewed_by_user_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ASSESSMENT_ATTEMPT_ANSWERS_REVIEWED_BY"`,
    );
    await queryRunner.query(`
      ALTER TABLE "assessment_attempt_answers"
      DROP COLUMN IF EXISTS "reviewed_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_attempt_answers"
      DROP COLUMN IF EXISTS "reviewed_by_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "assessment_attempt_answers"
      DROP COLUMN IF EXISTS "review_comment"
    `);
  }
}
