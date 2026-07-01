import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnifyMaterialAccess1730000000018 implements MigrationInterface {
  name = 'UnifyMaterialAccess1730000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TEMP TABLE "_material_access_effective" AS
      SELECT
        user_id,
        material_id,
        CASE
          WHEN bool_or(granted_by_role = 'ADMIN' AND access = false) THEN false
          WHEN bool_or(granted_by_role = 'ADMIN' AND access = true) THEN true
          WHEN bool_or(granted_by_role = 'TEACHER' AND access = true) THEN true
          ELSE false
        END AS effective,
        (
          SELECT sub.granted_by_role
          FROM material_access sub
          WHERE sub.user_id = material_access.user_id
            AND sub.material_id = material_access.material_id
          ORDER BY sub.updated_date DESC NULLS LAST
          LIMIT 1
        ) AS last_role
      FROM material_access
      GROUP BY user_id, material_id
    `);

    await queryRunner.query(`DELETE FROM "material_access"`);

    await queryRunner.query(`
      INSERT INTO "material_access" (
        "id",
        "user_id",
        "material_id",
        "granted_by_role",
        "access",
        "notes",
        "created_date",
        "updated_date"
      )
      SELECT
        uuid_generate_v4(),
        user_id,
        material_id,
        COALESCE(last_role, 'ADMIN'),
        true,
        NULL,
        NOW(),
        NOW()
      FROM "_material_access_effective"
      WHERE effective = true
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "_material_access_effective"`);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_MATERIAL_ACCESS_USER_MATERIAL_ROLE"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_MATERIAL_ACCESS_USER_MATERIAL"
      ON "material_access" ("user_id", "material_id")
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive data merge — no automatic rollback.
  }
}
