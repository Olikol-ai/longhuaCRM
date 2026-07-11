import { MigrationInterface, QueryRunner } from 'typeorm';

export class VerificationCodeHardening1730000000019 implements MigrationInterface {
  name = 'VerificationCodeHardening1730000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "verification_code_expires_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "verification_code_sent_at" timestamptz
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET
        "verification_code" = NULL,
        "verification_attempts" = 0,
        "verification_code_expires_at" = NULL,
        "verification_code_sent_at" = NULL
      WHERE "verification_code" IS NOT NULL
        AND "verification_code" NOT LIKE '$2%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "verification_code_expires_at",
        DROP COLUMN IF EXISTS "verification_code_sent_at"
    `);
  }
}
