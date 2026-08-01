import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Public invite links: at most one non-revoked row per teacher / tutor.
 * Cleans existing duplicates (keeps newest), then adds partial unique indexes.
 */
export class OneActiveInviteLinkPerOwner1745100000000 implements MigrationInterface {
  name = 'OneActiveInviteLinkPerOwner1745100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY teacher_id
                 ORDER BY created_at DESC, id DESC
               ) AS rn
        FROM teacher_invite_links
        WHERE revoked_at IS NULL
      )
      UPDATE teacher_invite_links AS t
      SET revoked_at = NOW(),
          updated_at = NOW()
      FROM ranked AS r
      WHERE t.id = r.id
        AND r.rn > 1
        AND t.revoked_at IS NULL
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY tutor_id
                 ORDER BY created_at DESC, id DESC
               ) AS rn
        FROM tutor_invite_links
        WHERE revoked_at IS NULL
      )
      UPDATE tutor_invite_links AS t
      SET revoked_at = NOW(),
          updated_at = NOW()
      FROM ranked AS r
      WHERE t.id = r.id
        AND r.rn > 1
        AND t.revoked_at IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_teacher_invite_links_one_active"
      ON "teacher_invite_links" ("teacher_id")
      WHERE "revoked_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tutor_invite_links_one_active"
      ON "tutor_invite_links" ("tutor_id")
      WHERE "revoked_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tutor_invite_links_one_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_teacher_invite_links_one_active"`);
  }
}
