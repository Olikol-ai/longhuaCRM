import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Allow student status pending_assignment (awaiting teacher).
 * Initial schema used varchar; some installs may have a PG enum — handle both.
 */
export class StudentPendingAssignmentStatus1742100000000
  implements MigrationInterface
{
  name = 'StudentPendingAssignmentStatus1742100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        enum_name text;
      BEGIN
        SELECT t.typname INTO enum_name
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_type t ON t.oid = a.atttypid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'students'
          AND a.attname = 'status'
          AND t.typtype = 'e'
        LIMIT 1;

        IF enum_name IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = enum_name
              AND e.enumlabel = 'pending_assignment'
          ) THEN
            EXECUTE format('ALTER TYPE %I ADD VALUE %L', enum_name, 'pending_assignment');
          END IF;
        END IF;
      END $$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL cannot easily remove enum values; leave as-is.
  }
}
