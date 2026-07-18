import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Links CRM certificates to Assessment results (source provenance).
 * Does not modify assessment_* tables.
 */
export class CertificateAssessmentSource1740600000000 implements MigrationInterface {
  name = 'CertificateAssessmentSource1740600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "certificates"
      ADD COLUMN IF NOT EXISTS "source" character varying(32)
    `);

    await queryRunner.query(`
      ALTER TABLE "certificates"
      ADD COLUMN IF NOT EXISTS "assessment_result_id" uuid
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_CERTIFICATES_ASSESSMENT_RESULT_ID"
      ON "certificates" ("assessment_result_id")
      WHERE "assessment_result_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_CERTIFICATES_SOURCE"
      ON "certificates" ("source")
      WHERE "source" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_CERTIFICATES_SOURCE"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_CERTIFICATES_ASSESSMENT_RESULT_ID"`);
    await queryRunner.query(`
      ALTER TABLE "certificates" DROP COLUMN IF EXISTS "assessment_result_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "certificates" DROP COLUMN IF EXISTS "source"
    `);
  }
}
