import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentContractFields1730000000004 implements MigrationInterface {
  name = 'PaymentContractFields1730000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
        ADD COLUMN IF NOT EXISTS "lessons_added" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "payment_date" date,
        ADD COLUMN IF NOT EXISTS "student_name" text,
        ADD COLUMN IF NOT EXISTS "package_type" text,
        ADD COLUMN IF NOT EXISTS "order_number" text
    `);

    await queryRunner.query(`
      UPDATE "payments"
      SET "payment_date" = COALESCE("payment_date", "paid_at"::date, "created_date"::date)
      WHERE "payment_date" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_ORDER_NUMBER" ON "payments" ("order_number")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_PAYMENT_DATE" ON "payments" ("payment_date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_PAYMENT_PAYMENT_DATE"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_PAYMENT_ORDER_NUMBER"`);
    await queryRunner.query(`
      ALTER TABLE "payments"
        DROP COLUMN IF EXISTS "order_number",
        DROP COLUMN IF EXISTS "package_type",
        DROP COLUMN IF EXISTS "student_name",
        DROP COLUMN IF EXISTS "payment_date",
        DROP COLUMN IF EXISTS "lessons_added"
    `);
  }
}
