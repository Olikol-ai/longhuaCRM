import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Month-level teacher salary payouts (teacher_id + month uniqueness).
 * Existing per-lesson teacher_payments rows are kept as accrual history.
 */
export class TeacherMonthlyPayouts1741500000000 implements MigrationInterface {
  name = 'TeacherMonthlyPayouts1741500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teacher_monthly_payouts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "teacher_id" uuid NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
        "month" varchar(7) NOT NULL,
        "amount" numeric(10,2) NOT NULL DEFAULT 0,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "paid_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_TEACHER_MONTHLY_PAYOUT_TEACHER_MONTH"
      ON "teacher_monthly_payouts" ("teacher_id", "month")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TEACHER_MONTHLY_PAYOUT_TEACHER_ID"
      ON "teacher_monthly_payouts" ("teacher_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TEACHER_MONTHLY_PAYOUT_MONTH"
      ON "teacher_monthly_payouts" ("month")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_TEACHER_MONTHLY_PAYOUT_MONTH"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_TEACHER_MONTHLY_PAYOUT_TEACHER_ID"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_TEACHER_MONTHLY_PAYOUT_TEACHER_MONTH"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "teacher_monthly_payouts"`);
  }
}
