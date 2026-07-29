import { MigrationInterface, QueryRunner } from 'typeorm';

export class HomeworkLocalResultAsAssignmentResult1742700000000 implements MigrationInterface {
  name = 'HomeworkLocalResultAsAssignmentResult1742700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Local tutor-students store execution metadata in homework_results without creating attempts.
    await queryRunner.query(`
      ALTER TABLE homework_results
      ALTER COLUMN attempt_id DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE homework_results
      ALTER COLUMN score DROP NOT NULL,
      ALTER COLUMN max_score DROP NOT NULL,
      ALTER COLUMN percent DROP NOT NULL,
      ALTER COLUMN passed DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE homework_results
      ADD COLUMN IF NOT EXISTS owner_comment text NULL,
      ADD COLUMN IF NOT EXISTS review_result text NULL,
      ADD COLUMN IF NOT EXISTS completed_at timestamptz NULL,
      ADD COLUMN IF NOT EXISTS checked_at timestamptz NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE homework_results
      DROP COLUMN IF EXISTS owner_comment,
      DROP COLUMN IF EXISTS review_result,
      DROP COLUMN IF EXISTS completed_at,
      DROP COLUMN IF EXISTS checked_at
    `);

    // NOTE: This down migration assumes there are no local results with NULL score/percent/etc.
    await queryRunner.query(`
      ALTER TABLE homework_results
      ALTER COLUMN passed SET NOT NULL,
      ALTER COLUMN score SET NOT NULL,
      ALTER COLUMN max_score SET NOT NULL,
      ALTER COLUMN percent SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE homework_results
      ALTER COLUMN attempt_id SET NOT NULL
    `);
  }
}

