import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Learner-facing description on assessment exams (nullable for backward compatibility).
 */
export class AssessmentExamDescription1746600000000 implements MigrationInterface {
  name = 'AssessmentExamDescription1746600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assessment_exams"
      ADD COLUMN IF NOT EXISTS "description" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assessment_exams"
      DROP COLUMN IF EXISTS "description"
    `);
  }
}
