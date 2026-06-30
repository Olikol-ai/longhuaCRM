import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductionHardening1730000000017 implements MigrationInterface {
  name = 'ProductionHardening1730000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "lesson_materials"
      WHERE COALESCE(NULLIF(TRIM("file_url"), ''), NULL) IS NULL
        AND COALESCE(NULLIF(TRIM("external_link"), ''), NULL) IS NULL
    `);

    await queryRunner.query(`
      UPDATE "lesson_materials" m
      SET "folder_id" = NULL, "updated_date" = NOW()
      FROM "course_folders" f
      WHERE m."folder_id" = f."id"
        AND m."course_id" <> f."course_id"
    `);

    await queryRunner.query(`
      UPDATE "course_folders" child
      SET "parent_folder_id" = NULL, "updated_date" = NOW()
      WHERE child."parent_folder_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "course_folders" parent
          WHERE parent."id" = child."parent_folder_id"
        )
    `);

    await queryRunner.query(`
      UPDATE "course_folders" child
      SET "parent_folder_id" = NULL, "updated_date" = NOW()
      FROM "course_folders" parent
      WHERE child."parent_folder_id" = parent."id"
        AND child."course_id" <> parent."course_id"
    `);

    await queryRunner.query(`
      DELETE FROM "course_folders" f
      WHERE NOT EXISTS (
        SELECT 1 FROM "courses" c WHERE c."id" = f."course_id"
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "lesson_materials"
      ADD CONSTRAINT "CHK_LESSON_MATERIALS_SOURCE"
      CHECK (
        COALESCE(NULLIF(TRIM("file_url"), ''), NULL) IS NOT NULL
        OR COALESCE(NULLIF(TRIM("external_link"), ''), NULL) IS NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "lesson_materials"
      DROP CONSTRAINT IF EXISTS "CHK_LESSON_MATERIALS_SOURCE"
    `);
  }
}
