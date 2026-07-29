import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remove legacy ExamTemplate / Blueprint authoring.
 * ExamBlock is the only composition source for exams.
 */
export class DropAssessmentBlueprintTemplate1742900000000
  implements MigrationInterface
{
  name = 'DropAssessmentBlueprintTemplate1742900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ASSESSMENT_EXAMS_BLUEPRINT_ID"`,
    );

    // Drop FK assessment_exams.blueprint_id → assessment_blueprints if present.
    await queryRunner.query(`
      DO $$
      DECLARE
        fk_name text;
      BEGIN
        SELECT con.conname INTO fk_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'assessment_exams'
          AND con.contype = 'f'
          AND pg_get_constraintdef(con.oid) ILIKE '%blueprint_id%';
        IF fk_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE assessment_exams DROP CONSTRAINT %I', fk_name);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE assessment_exams
      DROP COLUMN IF EXISTS blueprint_id
    `);

    await queryRunner.query(
      `DROP TABLE IF EXISTS assessment_blueprint_section_rules CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS assessment_blueprints CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS assessment_exam_templates CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Irreversible cleanup — tables are not recreated.
    await queryRunner.query(`SELECT 1`);
  }
}
