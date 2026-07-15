import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Manual ordering of courses in Materials sidebar (drag-and-drop).
 */
export class CourseTemplateSortOrder1740400000000 implements MigrationInterface {
  name = 'CourseTemplateSortOrder1740400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course_templates"
      ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      WITH ranked AS (
        SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, name ASC) - 1) AS rn
        FROM "course_templates"
      )
      UPDATE "course_templates" AS c
      SET "sort_order" = ranked.rn
      FROM ranked
      WHERE c.id = ranked.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "course_templates"
      DROP COLUMN IF EXISTS "sort_order"
    `);
  }
}
