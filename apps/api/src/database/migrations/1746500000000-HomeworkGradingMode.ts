import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persist how a homework percent was produced (auto vs teacher manual)
 * and whether students may see expected answers after review.
 */
export class HomeworkGradingMode1746500000000 implements MigrationInterface {
  name = 'HomeworkGradingMode1746500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE homework_results
        ADD COLUMN IF NOT EXISTS grading_mode varchar(16) NOT NULL DEFAULT 'auto',
        ADD COLUMN IF NOT EXISTS manual_percentage numeric(5, 2) NULL,
        ADD COLUMN IF NOT EXISTS show_correct_answers boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      UPDATE homework_results
      SET grading_mode = 'auto'
      WHERE grading_mode IS NULL OR grading_mode = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE homework_results
        DROP COLUMN IF EXISTS show_correct_answers,
        DROP COLUMN IF EXISTS manual_percentage,
        DROP COLUMN IF EXISTS grading_mode
    `);
  }
}
