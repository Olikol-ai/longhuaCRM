import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tutor MaterialsHub isolation:
 * - personal folders owned by creator (created_by_user_id)
 * - MaterialAccess can target tutor_students (including local, user_id null)
 * - when a local tutor student registers, grants keep tutor_student_id and gain user_id
 */
export class TutorMaterialAccess1742500000000 implements MigrationInterface {
  name = 'TutorMaterialAccess1742500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "material_folders"
      ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_material_folders_created_by_user'
        ) THEN
          ALTER TABLE "material_folders"
          ADD CONSTRAINT "FK_material_folders_created_by_user"
          FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_MATERIAL_FOLDERS_CREATED_BY_USER"
      ON "material_folders" ("created_by_user_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "material_access"
      ADD COLUMN IF NOT EXISTS "tutor_student_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "material_access"
      ALTER COLUMN "user_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_material_access_tutor_student'
        ) THEN
          ALTER TABLE "material_access"
          ADD CONSTRAINT "FK_material_access_tutor_student"
          FOREIGN KEY ("tutor_student_id") REFERENCES "tutor_students"("id")
          ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "material_access"
      DROP CONSTRAINT IF EXISTS "material_access_user_id_material_id_key"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_MATERIAL_ACCESS_USER_MATERIAL"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_material_access_user_material"
      ON "material_access" ("user_id", "material_id")
      WHERE "user_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_material_access_tutor_student_material"
      ON "material_access" ("tutor_student_id", "material_id")
      WHERE "tutor_student_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_MATERIAL_ACCESS_TUTOR_STUDENT_ID"
      ON "material_access" ("tutor_student_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "material_access"
      DROP CONSTRAINT IF EXISTS "CHK_material_access_subject"
    `);
    await queryRunner.query(`
      ALTER TABLE "material_access"
      ADD CONSTRAINT "CHK_material_access_subject"
      CHECK ("user_id" IS NOT NULL OR "tutor_student_id" IS NOT NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "material_access"
      DROP CONSTRAINT IF EXISTS "CHK_material_access_subject"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_MATERIAL_ACCESS_TUTOR_STUDENT_ID"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_material_access_tutor_student_material"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_material_access_user_material"
    `);
    await queryRunner.query(`
      ALTER TABLE "material_access"
      DROP CONSTRAINT IF EXISTS "FK_material_access_tutor_student"
    `);
    await queryRunner.query(`
      DELETE FROM "material_access" WHERE "user_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "material_access"
      ALTER COLUMN "user_id" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "material_access"
      DROP COLUMN IF EXISTS "tutor_student_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "material_access"
      ADD CONSTRAINT "material_access_user_id_material_id_key"
      UNIQUE ("user_id", "material_id")
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_MATERIAL_FOLDERS_CREATED_BY_USER"
    `);
    await queryRunner.query(`
      ALTER TABLE "material_folders"
      DROP CONSTRAINT IF EXISTS "FK_material_folders_created_by_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "material_folders"
      DROP COLUMN IF EXISTS "created_by_user_id"
    `);
  }
}
