import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3ProductionReadiness1733000000000 implements MigrationInterface {
  name = 'Phase3ProductionReadiness1733000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lesson_series"
      ADD COLUMN IF NOT EXISTS "course_id" uuid REFERENCES "course_templates"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "group_id" uuid REFERENCES "groups"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "frequency" varchar NOT NULL DEFAULT 'weekly',
      ADD COLUMN IF NOT EXISTS "total_lessons" int NOT NULL DEFAULT 35
    `);

    await queryRunner.query(`
      ALTER TABLE "enrollments"
      ADD COLUMN IF NOT EXISTS "missed_lessons" int NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_LESSON_SERIES_COURSE_ID" ON "lesson_series" ("course_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_LESSON_SERIES_GROUP_ID" ON "lesson_series" ("group_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "enrollments" DROP COLUMN IF EXISTS "missed_lessons"`);
    await queryRunner.query(`ALTER TABLE "lesson_series" DROP COLUMN IF EXISTS "total_lessons"`);
    await queryRunner.query(`ALTER TABLE "lesson_series" DROP COLUMN IF EXISTS "frequency"`);
    await queryRunner.query(`ALTER TABLE "lesson_series" DROP COLUMN IF EXISTS "group_id"`);
    await queryRunner.query(`ALTER TABLE "lesson_series" DROP COLUMN IF EXISTS "course_id"`);
  }
}
