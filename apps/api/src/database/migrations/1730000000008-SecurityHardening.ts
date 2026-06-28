import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecurityHardening1730000000008 implements MigrationInterface {
  name = 'SecurityHardening1730000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "verification_attempts" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actor_user_id" uuid,
        "action" character varying(64) NOT NULL,
        "entity_type" character varying(64),
        "entity_id" character varying(128),
        "summary" text NOT NULL,
        "created_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_AUDIT_LOG_ACTOR" ON "audit_logs" ("actor_user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_AUDIT_LOG_ACTION" ON "audit_logs" ("action")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "verification_attempts"
    `);
  }
}
