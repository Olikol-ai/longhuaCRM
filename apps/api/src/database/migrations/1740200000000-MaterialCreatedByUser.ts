import { MigrationInterface, QueryRunner } from 'typeorm';

export class MaterialCreatedByUser1740200000000 implements MigrationInterface {
  name = 'MaterialCreatedByUser1740200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "materials"
      ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_materials_created_by_user'
        ) THEN
          ALTER TABLE "materials"
          ADD CONSTRAINT "FK_materials_created_by_user"
          FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_MATERIALS_CREATED_BY_USER"
      ON "materials" ("created_by_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_MATERIALS_CREATED_BY_USER"`);
    await queryRunner.query(`
      ALTER TABLE "materials" DROP CONSTRAINT IF EXISTS "FK_materials_created_by_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "materials" DROP COLUMN IF EXISTS "created_by_user_id"
    `);
  }
}
