import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Explicit course/group material grants for inherited access resolution.
 * Personal grants stay in material_access (user_id + material_id).
 */
export class MaterialInheritedGrants1739400000000 implements MigrationInterface {
  name = 'MaterialInheritedGrants1739400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "material_course_grants" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "course_template_id" uuid NOT NULL REFERENCES "course_templates"("id") ON DELETE CASCADE,
        "material_id" uuid NOT NULL REFERENCES "materials"("id") ON DELETE CASCADE,
        "granted_by_role" varchar(16) NOT NULL DEFAULT 'ADMIN',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_material_course_grants_course_material"
          UNIQUE ("course_template_id", "material_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_material_course_grants_course"
      ON "material_course_grants" ("course_template_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_material_course_grants_material"
      ON "material_course_grants" ("material_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "material_group_grants" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
        "material_id" uuid NOT NULL REFERENCES "materials"("id") ON DELETE CASCADE,
        "granted_by_role" varchar(16) NOT NULL DEFAULT 'ADMIN',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_material_group_grants_group_material"
          UNIQUE ("group_id", "material_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_material_group_grants_group"
      ON "material_group_grants" ("group_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_material_group_grants_material"
      ON "material_group_grants" ("material_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "material_group_grants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "material_course_grants"`);
  }
}
