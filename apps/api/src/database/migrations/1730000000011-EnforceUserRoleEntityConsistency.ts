import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceUserRoleEntityConsistency1730000000011 implements MigrationInterface {
  name = 'EnforceUserRoleEntityConsistency1730000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Resolve users linked as both student and teacher — keep profile matching users.role.
    await queryRunner.query(`
      UPDATE "teachers" t
      SET
        "status" = 'inactive',
        "user_id" = NULL,
        "updated_date" = NOW()
      FROM "students" s
      INNER JOIN "users" u ON u.id = s.user_id
      WHERE t.user_id = s.user_id
        AND s.user_id IS NOT NULL
        AND u.role = 'student'
    `);

    await queryRunner.query(`
      UPDATE "students" s
      SET
        "status" = 'inactive',
        "user_id" = NULL,
        "updated_date" = NOW()
      FROM "teachers" t
      INNER JOIN "users" u ON u.id = t.user_id
      WHERE s.user_id = t.user_id
        AND t.user_id IS NOT NULL
        AND u.role = 'teacher'
    `);

    // Admin and pending users must not own student/teacher profiles.
    await queryRunner.query(`
      UPDATE "students" s
      SET
        "status" = 'inactive',
        "user_id" = NULL,
        "updated_date" = NOW()
      FROM "users" u
      WHERE s.user_id = u.id
        AND u.role IN ('admin', '', 'pending')
    `);

    await queryRunner.query(`
      UPDATE "teachers" t
      SET
        "status" = 'inactive',
        "user_id" = NULL,
        "updated_date" = NOW()
      FROM "users" u
      WHERE t.user_id = u.id
        AND u.role IN ('admin', '', 'pending')
    `);

    // Dedupe multiple student rows for the same user_id (keep best candidate).
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id
            ORDER BY
              CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
              updated_date DESC,
              created_date DESC
          ) AS rn
        FROM "students"
        WHERE user_id IS NOT NULL
      )
      UPDATE "students" s
      SET
        "user_id" = NULL,
        "updated_date" = NOW()
      FROM ranked r
      WHERE s.id = r.id
        AND r.rn > 1
    `);

    // Dedupe multiple teacher rows for the same user_id.
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id
            ORDER BY
              CASE status WHEN 'active' THEN 0 ELSE 1 END,
              updated_date DESC,
              created_date DESC
          ) AS rn
        FROM "teachers"
        WHERE user_id IS NOT NULL
      )
      UPDATE "teachers" t
      SET
        "user_id" = NULL,
        "updated_date" = NOW()
      FROM ranked r
      WHERE t.id = r.id
        AND r.rn > 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_STUDENT_USER_ID"
      ON "students" ("user_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_TEACHER_USER_ID"
      ON "teachers" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_TEACHER_USER_ID"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_STUDENT_USER_ID"`);
  }
}
