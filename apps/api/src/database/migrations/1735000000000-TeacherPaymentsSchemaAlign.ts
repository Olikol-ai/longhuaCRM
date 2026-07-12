import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns legacy teacher_payments rows with TeacherPaymentEntity (v2).
 * Safe on fresh v2 installs — uses ADD COLUMN IF NOT EXISTS only.
 */
export class TeacherPaymentsSchemaAlign1735000000000 implements MigrationInterface {
  name = 'TeacherPaymentsSchemaAlign1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_payments"
      ADD COLUMN IF NOT EXISTS "paid_at" timestamptz
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_payments"
      ADD COLUMN IF NOT EXISTS "created_at" timestamptz
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'teacher_payments' AND column_name = 'created_date'
        ) THEN
          UPDATE "teacher_payments"
          SET "created_at" = "created_date"
          WHERE "created_at" IS NULL AND "created_date" IS NOT NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'teacher_payments' AND column_name = 'updated_date'
        ) THEN
          UPDATE "teacher_payments"
          SET "paid_at" = "updated_date"
          WHERE "paid_at" IS NULL
            AND "status"::text = 'paid'
            AND "updated_date" IS NOT NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_TEACHER_PAYMENT_LESSON_ID"
      ON "teacher_payments" ("lesson_id")
      WHERE "lesson_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_TEACHER_PAYMENT_LESSON_ID"`);
    await queryRunner.query(`ALTER TABLE "teacher_payments" DROP COLUMN IF EXISTS "paid_at"`);
  }
}
