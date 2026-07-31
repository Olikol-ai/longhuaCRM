import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Speeds up Materials hub ACL + list queries:
 * - enrollments by student (teacher/student course resolution)
 * - folders by course template
 * - materials by folder+status (course-related material discovery)
 * - personal grants filtered by access=true
 */
export class MaterialsListPerformanceIndexes1745000000000
  implements MigrationInterface
{
  name = 'MaterialsListPerformanceIndexes1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ENROLLMENTS_STUDENT_ID"
      ON "enrollments" ("student_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_MATERIAL_FOLDERS_COURSE_TEMPLATE_ID"
      ON "material_folders" ("course_template_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_MATERIALS_FOLDER_STATUS"
      ON "materials" ("folder_id", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_MATERIAL_ACCESS_USER_ACCESS"
      ON "material_access" ("user_id", "access")
      WHERE "user_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_MATERIAL_ACCESS_USER_ACCESS"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_MATERIALS_FOLDER_STATUS"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_MATERIAL_FOLDERS_COURSE_TEMPLATE_ID"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ENROLLMENTS_STUDENT_ID"`);
  }
}
