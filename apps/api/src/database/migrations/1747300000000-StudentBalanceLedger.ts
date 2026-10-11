import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Append-only ledger for students.lesson_balance mutations.
 * Does not rewrite historical balances — future ops must go through the ledger.
 */
export class StudentBalanceLedger1747300000000 implements MigrationInterface {
  name = 'StudentBalanceLedger1747300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "student_balance_ledger" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "student_id" uuid NOT NULL,
        "delta" integer NOT NULL,
        "balance_before" integer NOT NULL,
        "balance_after" integer NOT NULL,
        "operation_type" character varying(32) NOT NULL,
        "source_type" character varying(32) NOT NULL,
        "source_id" character varying(64) NULL,
        "idempotency_key" character varying(191) NOT NULL,
        "description" text NULL,
        "created_by_user_id" uuid NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_student_balance_ledger_student"
          FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_student_balance_ledger_created_by"
          FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_student_balance_ledger_idempotency"
          UNIQUE ("idempotency_key")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_STUDENT_BALANCE_LEDGER_STUDENT"
      ON "student_balance_ledger" ("student_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_STUDENT_BALANCE_LEDGER_CREATED"
      ON "student_balance_ledger" ("created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_STUDENT_BALANCE_LEDGER_SOURCE"
      ON "student_balance_ledger" ("source_type", "source_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_STUDENT_BALANCE_LEDGER_SOURCE"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_STUDENT_BALANCE_LEDGER_CREATED"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_STUDENT_BALANCE_LEDGER_STUDENT"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "student_balance_ledger"`);
  }
}
