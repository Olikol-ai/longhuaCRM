import { MigrationInterface, QueryRunner } from 'typeorm';

export class StudentMergeFoundation1747100000000 implements MigrationInterface {
  name = 'StudentMergeFoundation1747100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "students"
      ADD COLUMN IF NOT EXISTS "merged_into_student_id" uuid NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_students_merged_into_student'
        ) THEN
          ALTER TABLE "students"
          ADD CONSTRAINT "FK_students_merged_into_student"
          FOREIGN KEY ("merged_into_student_id") REFERENCES "students"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_students_merged_into_student_id"
      ON "students" ("merged_into_student_id")
      WHERE "merged_into_student_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_students_merged_into_student_id"`);
    await queryRunner.query(`
      ALTER TABLE "students"
      DROP CONSTRAINT IF EXISTS "FK_students_merged_into_student"
    `);
    await queryRunner.query(`
      ALTER TABLE "students"
      DROP COLUMN IF EXISTS "merged_into_student_id"
    `);
  }
}
