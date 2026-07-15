import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeacherInviteLinks1740300000000 implements MigrationInterface {
  name = 'TeacherInviteLinks1740300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teacher_invite_links" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "teacher_id" uuid NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
        "token_hash" text NOT NULL,
        "label" text NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz NULL,
        "created_by_user_id" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
        "use_count" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_teacher_invite_links_token_hash"
      ON "teacher_invite_links" ("token_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_teacher_invite_links_teacher_id"
      ON "teacher_invite_links" ("teacher_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "pending_registrations"
      ADD COLUMN IF NOT EXISTS "invite_teacher_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_registrations"
      ADD COLUMN IF NOT EXISTS "invite_link_id" uuid NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_pending_registrations_invite_teacher'
        ) THEN
          ALTER TABLE "pending_registrations"
          ADD CONSTRAINT "FK_pending_registrations_invite_teacher"
          FOREIGN KEY ("invite_teacher_id") REFERENCES "teachers"("id")
          ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_pending_registrations_invite_link'
        ) THEN
          ALTER TABLE "pending_registrations"
          ADD CONSTRAINT "FK_pending_registrations_invite_link"
          FOREIGN KEY ("invite_link_id") REFERENCES "teacher_invite_links"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pending_registrations"
      DROP CONSTRAINT IF EXISTS "FK_pending_registrations_invite_link"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_registrations"
      DROP CONSTRAINT IF EXISTS "FK_pending_registrations_invite_teacher"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_registrations"
      DROP COLUMN IF EXISTS "invite_link_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_registrations"
      DROP COLUMN IF EXISTS "invite_teacher_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "teacher_invite_links"`);
  }
}
