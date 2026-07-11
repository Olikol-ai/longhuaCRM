import { MigrationInterface, QueryRunner } from 'typeorm';

export class PendingRegistration1730000000020 implements MigrationInterface {
  name = 'PendingRegistration1730000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pending_registrations" (
        "id" uuid NOT NULL,
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "first_name" character varying NOT NULL DEFAULT '',
        "last_name" character varying NOT NULL DEFAULT '',
        "phone" character varying NOT NULL DEFAULT '',
        "verification_code_hash" text,
        "code_expires_at" timestamptz,
        "last_sent_at" timestamptz,
        "send_count" integer NOT NULL DEFAULT 0,
        "verification_attempts" integer NOT NULL DEFAULT 0,
        "status" character varying NOT NULL DEFAULT 'pending',
        "expires_at" timestamptz NOT NULL,
        "created_date" timestamptz NOT NULL DEFAULT now(),
        "updated_date" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pending_registrations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pending_registrations_email"
        ON "pending_registrations" ("email")
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "email_verified" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "email_verified" = true
      WHERE "status" = 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pending_registrations"`);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified"
    `);
  }
}
