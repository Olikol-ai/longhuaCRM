import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns DB columns with v2 entities where InitialSchemaV2 CREATE IF NOT EXISTS
 * skipped altering existing legacy tables.
 */
export class SchemaEntityAlign1736000000000 implements MigrationInterface {
  name = 'SchemaEntityAlign1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lesson_series_students"
      ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "lesson_series_students"
      ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      ALTER TABLE "material_links"
      ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "material_links"
      ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      ALTER TABLE "lesson_series_exclusions"
      ADD COLUMN IF NOT EXISTS "recurrence_index" int
    `);
    await queryRunner.query(`
      ALTER TABLE "lesson_series_exclusions"
      ADD COLUMN IF NOT EXISTS "reason" varchar NOT NULL DEFAULT 'deleted'
    `);
    await queryRunner.query(`
      ALTER TABLE "lesson_series_exclusions"
      ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      UPDATE "lesson_series_exclusions"
      SET "recurrence_index" = 0
      WHERE "recurrence_index" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_SERIES_EXCLUSION_SERIES_INDEX"
      ON "lesson_series_exclusions" ("series_id", "recurrence_index")
      WHERE "recurrence_index" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_SERIES_EXCLUSION_SERIES_INDEX"`);
  }
}
