import { MigrationInterface, QueryRunner } from 'typeorm';

export class CertificateUniquenessAlign1737000000000 implements MigrationInterface {
  name = 'CertificateUniquenessAlign1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_CERTIFICATES_BLANK_SERIES_NUMBER"
      ON "certificates" ("blank_series", "blank_number")
      WHERE "blank_series" IS NOT NULL
        AND TRIM("blank_series") <> ''
        AND "blank_number" IS NOT NULL
        AND TRIM("blank_number") <> ''
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_CERTIFICATES_STUDENT_COURSE_ACTIVE"
      ON "certificates" ("student_id", "course_id")
      WHERE "status" IN ('issued', 'sent')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_CERTIFICATES_STUDENT_COURSE_ACTIVE"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_CERTIFICATES_BLANK_SERIES_NUMBER"`);
  }
}
