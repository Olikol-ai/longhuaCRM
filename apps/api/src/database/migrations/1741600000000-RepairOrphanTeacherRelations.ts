import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RepairOrphanTeacherRelations
 *
 * - Deactivate / detach teachers without a valid active teacher User
 * - Clear users.role='teacher' when no Teacher profile exists
 * - Preserve teacher_payments history (never delete payment rows)
 * - Ensure teachers.user_id uniqueness
 * - Soften teacher_monthly_payouts FK to SET NULL so payout history survives teacher deletion
 */
export class RepairOrphanTeacherRelations1741600000000
  implements MigrationInterface
{
  name = 'RepairOrphanTeacherRelations1741600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Preserve monthly payout history when teacher rows are removed ---
    await queryRunner.query(`
      ALTER TABLE "teacher_monthly_payouts"
      ALTER COLUMN "teacher_id" DROP NOT NULL
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        fk_name text;
      BEGIN
        SELECT tc.constraint_name INTO fk_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'teacher_monthly_payouts'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'teacher_id'
        LIMIT 1;

        IF fk_name IS NOT NULL THEN
          EXECUTE format(
            'ALTER TABLE teacher_monthly_payouts DROP CONSTRAINT %I',
            fk_name
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_schema = 'public'
            AND table_name = 'teacher_monthly_payouts'
            AND constraint_name = 'FK_teacher_monthly_payouts_teacher_id_set_null'
        ) THEN
          ALTER TABLE "teacher_monthly_payouts"
          ADD CONSTRAINT "FK_teacher_monthly_payouts_teacher_id_set_null"
          FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // --- Deduplicate teachers.user_id before unique index (keep earliest) ---
    const duplicateUsers = await queryRunner.query(`
      SELECT user_id, COUNT(*)::int AS cnt
      FROM teachers
      WHERE user_id IS NOT NULL
      GROUP BY user_id
      HAVING COUNT(*) > 1
    `);
    if (Array.isArray(duplicateUsers) && duplicateUsers.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[RepairOrphanTeacherRelations] duplicate teachers.user_id groups=${duplicateUsers.length}`,
      );
      await queryRunner.query(`
        WITH ranked AS (
          SELECT
            id,
            user_id,
            ROW_NUMBER() OVER (
              PARTITION BY user_id
              ORDER BY created_at ASC, id ASC
            ) AS rn
          FROM teachers
          WHERE user_id IS NOT NULL
        )
        UPDATE teachers t
        SET user_id = NULL,
            status = 'inactive',
            updated_at = NOW()
        FROM ranked r
        WHERE t.id = r.id
          AND r.rn > 1
      `);
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_TEACHER_USER_ID"
      ON "teachers" ("user_id")
      WHERE "user_id" IS NOT NULL
    `);

    // Teachers pointing at missing users
    const missingUserResult = await queryRunner.query(`
      WITH updated AS (
        UPDATE teachers t
        SET user_id = NULL,
            status = 'inactive',
            updated_at = NOW()
        WHERE t.user_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.user_id)
        RETURNING t.id
      )
      SELECT COUNT(*)::int AS cnt FROM updated
    `);
    const missingUserCount = Number(missingUserResult?.[0]?.cnt ?? 0);

    // Teachers with null user_id stay inactive
    const nullUserResult = await queryRunner.query(`
      WITH updated AS (
        UPDATE teachers
        SET status = 'inactive',
            updated_at = NOW()
        WHERE user_id IS NULL
          AND status IS DISTINCT FROM 'inactive'
        RETURNING id
      )
      SELECT COUNT(*)::int AS cnt FROM updated
    `);
    const nullUserCount = Number(nullUserResult?.[0]?.cnt ?? 0);

    // Teachers linked to non-teacher or non-active users → detach + inactive
    const badLinkResult = await queryRunner.query(`
      WITH updated AS (
        UPDATE teachers t
        SET user_id = NULL,
            status = 'inactive',
            updated_at = NOW()
        FROM users u
        WHERE t.user_id = u.id
          AND (
            COALESCE(u.role, '') IS DISTINCT FROM 'teacher'
            OR COALESCE(u.status, '') IS DISTINCT FROM 'active'
          )
        RETURNING t.id
      )
      SELECT COUNT(*)::int AS cnt FROM updated
    `);
    const badLinkCount = Number(badLinkResult?.[0]?.cnt ?? 0);

    // Users claiming teacher role without Teacher profile
    const roleFixResult = await queryRunner.query(`
      WITH updated AS (
        UPDATE users u
        SET role = '',
            updated_date = NOW()
        WHERE COALESCE(u.role, '') = 'teacher'
          AND NOT EXISTS (
            SELECT 1 FROM teachers t WHERE t.user_id = u.id
          )
        RETURNING u.id
      )
      SELECT COUNT(*)::int AS cnt FROM updated
    `);
    const roleFixCount = Number(roleFixResult?.[0]?.cnt ?? 0);

    // eslint-disable-next-line no-console
    console.log(
      `[RepairOrphanTeacherRelations] missingUser=${missingUserCount} nullUserInactivated=${nullUserCount} badLinkDetached=${badLinkCount} teacherRoleCleared=${roleFixCount}`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Data repair is not safely reversible.
  }
}
