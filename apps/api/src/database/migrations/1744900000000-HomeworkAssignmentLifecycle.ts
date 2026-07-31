import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Align homework assignment lifecycle with product statuses and timestamps:
 * assigned | started | submitted | checked | expired | cancelled (+ needs_revision)
 */
export class HomeworkAssignmentLifecycle1744900000000 implements MigrationInterface {
  name = 'HomeworkAssignmentLifecycle1744900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE homework_assignments
        ADD COLUMN IF NOT EXISTS started_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS submitted_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS checked_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS checked_by_user_id uuid NULL
    `);

    await queryRunner.query(`
      UPDATE homework_assignments SET status = 'started' WHERE status = 'in_progress'
    `);
    await queryRunner.query(`
      UPDATE homework_assignments SET status = 'checked' WHERE status = 'reviewed'
    `);
    await queryRunner.query(`
      UPDATE homework_assignments SET status = 'expired' WHERE status = 'overdue'
    `);

    // Backfill timestamps from attempts / legacy manual_checked_at
    await queryRunner.query(`
      UPDATE homework_assignments a
      SET started_at = sub.started_at
      FROM (
        SELECT DISTINCT ON (assignment_id)
          assignment_id,
          started_at
        FROM homework_attempts
        WHERE started_at IS NOT NULL
        ORDER BY assignment_id, started_at ASC
      ) sub
      WHERE a.id = sub.assignment_id
        AND a.started_at IS NULL
    `);

    await queryRunner.query(`
      UPDATE homework_assignments a
      SET submitted_at = sub.submitted_at
      FROM (
        SELECT DISTINCT ON (assignment_id)
          assignment_id,
          submitted_at
        FROM homework_attempts
        WHERE submitted_at IS NOT NULL
        ORDER BY assignment_id, submitted_at DESC
      ) sub
      WHERE a.id = sub.assignment_id
        AND a.submitted_at IS NULL
    `);

    await queryRunner.query(`
      UPDATE homework_assignments
      SET checked_at = COALESCE(checked_at, manual_checked_at)
      WHERE checked_at IS NULL AND manual_checked_at IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE homework_assignments
      SET checked_by_user_id = assigned_by_user_id
      WHERE status = 'checked'
        AND checked_by_user_id IS NULL
        AND assigned_by_user_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE homework_assignments SET status = 'in_progress' WHERE status = 'started'
    `);
    await queryRunner.query(`
      UPDATE homework_assignments SET status = 'reviewed' WHERE status = 'checked'
    `);
    await queryRunner.query(`
      UPDATE homework_assignments SET status = 'overdue' WHERE status = 'expired'
    `);
    await queryRunner.query(`
      ALTER TABLE homework_assignments
        DROP COLUMN IF EXISTS started_at,
        DROP COLUMN IF EXISTS submitted_at,
        DROP COLUMN IF EXISTS checked_at,
        DROP COLUMN IF EXISTS checked_by_user_id
    `);
  }
}
