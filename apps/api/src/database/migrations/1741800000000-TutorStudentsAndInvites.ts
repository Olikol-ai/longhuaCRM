import { MigrationInterface, QueryRunner } from 'typeorm';

export class TutorStudentsAndInvites1741800000000 implements MigrationInterface {
  name = 'TutorStudentsAndInvites1741800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "tutor_students_status_enum" AS ENUM ('active', 'inactive', 'paused');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tutor_students" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tutor_id" uuid NOT NULL REFERENCES "tutors"("id") ON DELETE CASCADE,
        "user_id" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
        "name" text NOT NULL,
        "first_name" text NULL,
        "last_name" text NULL,
        "email" text NULL,
        "phone" text NULL,
        "telegram_id" text NULL,
        "telegram_username" text NULL,
        "notes" text NULL,
        "status" "tutor_students_status_enum" NOT NULL DEFAULT 'active',
        "invite_link_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_TUTOR_STUDENT_USER_ID"
      ON "tutor_students" ("user_id")
      WHERE "user_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TUTOR_STUDENT_TUTOR_ID"
      ON "tutor_students" ("tutor_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TUTOR_STUDENT_EMAIL"
      ON "tutor_students" ("email")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tutor_invite_links" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tutor_id" uuid NOT NULL REFERENCES "tutors"("id") ON DELETE CASCADE,
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
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tutor_invite_links_token_hash"
      ON "tutor_invite_links" ("token_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tutor_invite_links_tutor_id"
      ON "tutor_invite_links" ("tutor_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "tutor_students"
      DROP CONSTRAINT IF EXISTS "FK_tutor_students_invite_link"
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_tutor_students_invite_link'
        ) THEN
          ALTER TABLE "tutor_students"
          ADD CONSTRAINT "FK_tutor_students_invite_link"
          FOREIGN KEY ("invite_link_id") REFERENCES "tutor_invite_links"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "pending_registrations"
      ADD COLUMN IF NOT EXISTS "invite_tutor_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_registrations"
      ADD COLUMN IF NOT EXISTS "invite_tutor_link_id" uuid NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_pending_registrations_invite_tutor'
        ) THEN
          ALTER TABLE "pending_registrations"
          ADD CONSTRAINT "FK_pending_registrations_invite_tutor"
          FOREIGN KEY ("invite_tutor_id") REFERENCES "tutors"("id")
          ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_pending_registrations_invite_tutor_link'
        ) THEN
          ALTER TABLE "pending_registrations"
          ADD CONSTRAINT "FK_pending_registrations_invite_tutor_link"
          FOREIGN KEY ("invite_tutor_link_id") REFERENCES "tutor_invite_links"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "lessons"
      ADD COLUMN IF NOT EXISTS "primary_tutor_student_id" uuid NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_LESSON_PRIMARY_TUTOR_STUDENT_ID"
      ON "lessons" ("primary_tutor_student_id")
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_lessons_primary_tutor_student'
        ) THEN
          ALTER TABLE "lessons"
          ADD CONSTRAINT "FK_lessons_primary_tutor_student"
          FOREIGN KEY ("primary_tutor_student_id") REFERENCES "tutor_students"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      ADD COLUMN IF NOT EXISTS "tutor_student_id" uuid NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_ATTENDANCE_TUTOR_STUDENT_ID"
      ON "attendance_records" ("tutor_student_id")
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_attendance_tutor_student'
        ) THEN
          ALTER TABLE "attendance_records"
          ADD CONSTRAINT "FK_attendance_tutor_student"
          FOREIGN KEY ("tutor_student_id") REFERENCES "tutor_students"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Migrate legacy school students that were assigned to tutors into tutor_students.
    // Keep the same UUID so lesson remapping stays simple.
    await queryRunner.query(`
      INSERT INTO "tutor_students" (
        "id", "tutor_id", "user_id", "name", "first_name", "last_name",
        "email", "phone", "telegram_id", "telegram_username", "notes",
        "status", "created_at", "updated_at"
      )
      SELECT
        s."id",
        s."assigned_tutor_id",
        s."user_id",
        s."name",
        s."first_name",
        s."last_name",
        s."email",
        s."phone",
        s."telegram_id",
        s."telegram_username",
        s."notes",
        CASE
          WHEN s."status"::text = 'paused' THEN 'paused'::tutor_students_status_enum
          WHEN s."status"::text = 'inactive' THEN 'inactive'::tutor_students_status_enum
          ELSE 'active'::tutor_students_status_enum
        END,
        s."created_at",
        s."updated_at"
      FROM "students" s
      WHERE s."assigned_tutor_id" IS NOT NULL
      ON CONFLICT ("id") DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE "lessons" l
      SET
        "primary_tutor_student_id" = l."primary_student_id",
        "primary_student_id" = NULL
      WHERE l."tutor_id" IS NOT NULL
        AND l."primary_student_id" IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM "tutor_students" ts WHERE ts."id" = l."primary_student_id"
        )
    `);

    await queryRunner.query(`
      UPDATE "attendance_records" a
      SET
        "tutor_student_id" = a."student_id",
        "student_id" = NULL
      WHERE a."student_id" IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM "tutor_students" ts WHERE ts."id" = a."student_id"
        )
        AND EXISTS (
          SELECT 1 FROM "lessons" l
          WHERE l."id" = a."lesson_id" AND l."tutor_id" IS NOT NULL
        )
    `);

    await queryRunner.query(`
      UPDATE "users" u
      SET "role" = 'tutor_student'
      WHERE u."role" = 'student'
        AND EXISTS (
          SELECT 1 FROM "tutor_students" ts
          WHERE ts."user_id" = u."id"
        )
    `);

    await queryRunner.query(`
      UPDATE "students" s
      SET
        "user_id" = NULL,
        "status" = 'inactive',
        "assigned_tutor_id" = NULL
      WHERE EXISTS (
        SELECT 1 FROM "tutor_students" ts WHERE ts."id" = s."id"
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      DROP CONSTRAINT IF EXISTS "FK_attendance_tutor_student"
    `);
    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      DROP COLUMN IF EXISTS "tutor_student_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "lessons"
      DROP CONSTRAINT IF EXISTS "FK_lessons_primary_tutor_student"
    `);
    await queryRunner.query(`
      ALTER TABLE "lessons"
      DROP COLUMN IF EXISTS "primary_tutor_student_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "pending_registrations"
      DROP CONSTRAINT IF EXISTS "FK_pending_registrations_invite_tutor_link"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_registrations"
      DROP CONSTRAINT IF EXISTS "FK_pending_registrations_invite_tutor"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_registrations"
      DROP COLUMN IF EXISTS "invite_tutor_link_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "pending_registrations"
      DROP COLUMN IF EXISTS "invite_tutor_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "tutor_students"
      DROP CONSTRAINT IF EXISTS "FK_tutor_students_invite_link"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "tutor_invite_links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tutor_students"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tutor_students_status_enum"`);
  }
}
