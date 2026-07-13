import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Material deletion must not erase lesson/course history.
 * Soft-delete via status='deleted' keeps material_links; FK becomes RESTRICT
 * so hard delete of linked materials fails safely.
 */
export class MaterialSoftDelete1739300000000 implements MigrationInterface {
  name = 'MaterialSoftDelete1739300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "materials"
      ADD COLUMN IF NOT EXISTS "status" varchar(32) NOT NULL DEFAULT 'active'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_MATERIALS_STATUS"
      ON "materials" ("status")
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
          AND tc.table_name = 'material_links'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'material_id'
        LIMIT 1;

        IF fk_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "material_links" DROP CONSTRAINT %I', fk_name);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = 'public'
            AND table_name = 'material_links'
            AND constraint_name = 'FK_material_links_material_id_restrict'
        ) THEN
          ALTER TABLE "material_links"
          ADD CONSTRAINT "FK_material_links_material_id_restrict"
          FOREIGN KEY ("material_id") REFERENCES "materials"("id")
          ON DELETE RESTRICT;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = 'public'
            AND table_name = 'material_links'
            AND constraint_name = 'FK_material_links_material_id_restrict'
        ) THEN
          ALTER TABLE "material_links" DROP CONSTRAINT "FK_material_links_material_id_restrict";
          ALTER TABLE "material_links"
          ADD CONSTRAINT "FK_material_links_material_id"
          FOREIGN KEY ("material_id") REFERENCES "materials"("id")
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_MATERIALS_STATUS"`);
    await queryRunner.query(`ALTER TABLE "materials" DROP COLUMN IF EXISTS "status"`);
  }
}
