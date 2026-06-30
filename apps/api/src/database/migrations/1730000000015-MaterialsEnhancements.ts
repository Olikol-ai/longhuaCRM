import { MigrationInterface, QueryRunner } from 'typeorm';

export class MaterialsEnhancements1730000000015 implements MigrationInterface {
  name = 'MaterialsEnhancements1730000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lesson_materials"
      ALTER COLUMN "file_url" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "lesson_materials"
      ADD COLUMN IF NOT EXISTS "external_link" text
    `);

    await queryRunner.query(`
      ALTER TABLE "lesson_materials"
      ADD COLUMN IF NOT EXISTS "folder_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_LESSON_MATERIAL_FOLDER_ID"
      ON "lesson_materials" ("folder_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_folders" (
        "id" uuid NOT NULL,
        "course_id" uuid NOT NULL,
        "parent_folder_id" uuid,
        "name" text NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_folders" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_COURSE_FOLDER_COURSE_ID"
      ON "course_folders" ("course_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_COURSE_FOLDER_PARENT_ID"
      ON "course_folders" ("parent_folder_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "course_folders"
      ADD CONSTRAINT "FK_course_folders_course_id"
      FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
      NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE "course_folders"
      ADD CONSTRAINT "FK_course_folders_parent_folder_id"
      FOREIGN KEY ("parent_folder_id") REFERENCES "course_folders"("id") ON DELETE CASCADE
      NOT VALID
    `);

    await queryRunner.query(`
      ALTER TABLE "lesson_materials"
      ADD CONSTRAINT "FK_lesson_materials_folder_id"
      FOREIGN KEY ("folder_id") REFERENCES "course_folders"("id") ON DELETE SET NULL
      NOT VALID
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_MATERIAL_ACCESS_USER_MATERIAL_ROLE"
      ON "material_access" ("user_id", "material_id", "granted_by_role")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_MATERIAL_ACCESS_USER_MATERIAL_ROLE"`);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "lesson_materials"
      DROP CONSTRAINT IF EXISTS "FK_lesson_materials_folder_id"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "course_folders"
      DROP CONSTRAINT IF EXISTS "FK_course_folders_parent_folder_id"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "course_folders"
      DROP CONSTRAINT IF EXISTS "FK_course_folders_course_id"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_COURSE_FOLDER_PARENT_ID"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_COURSE_FOLDER_COURSE_ID"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "course_folders"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_LESSON_MATERIAL_FOLDER_ID"`);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "lesson_materials"
      DROP COLUMN IF EXISTS "folder_id"
    `);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "lesson_materials"
      DROP COLUMN IF EXISTS "external_link"
    `);
    await queryRunner.query(`
      ALTER TABLE "lesson_materials"
      ALTER COLUMN "file_url" SET NOT NULL
    `);
  }
}
