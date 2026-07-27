import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Foundation for external Tutor (Репетитор) partners.
 * Additive only: new table + nullable FKs. No data rewrites.
 */
export class TutorFoundation1741700000000 implements MigrationInterface {
  name = 'TutorFoundation1741700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "tutors_status_enum" AS ENUM ('active', 'inactive', 'pending');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tutors" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid,
        "status" "tutors_status_enum" NOT NULL DEFAULT 'pending',
        "display_name" text NOT NULL,
        "bio" text,
        "specializations" text,
        "email" text,
        "phone" text,
        "default_lesson_price" numeric,
        "commission_percent" numeric DEFAULT 1,
        "payout_account_ref" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tutors" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_TUTOR_USER_ID"
      ON "tutors" ("user_id")
      WHERE "user_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_TUTOR_EMAIL"
      ON "tutors" ("email")
      WHERE "email" IS NOT NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "tutors"
          ADD CONSTRAINT "FK_tutors_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "students"
        ADD COLUMN IF NOT EXISTS "assigned_tutor_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_STUDENT_ASSIGNED_TUTOR_ID"
      ON "students" ("assigned_tutor_id")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "students"
          ADD CONSTRAINT "FK_students_assigned_tutor_id"
          FOREIGN KEY ("assigned_tutor_id") REFERENCES "tutors"("id")
          ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "lessons"
        ADD COLUMN IF NOT EXISTS "tutor_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_LESSON_TUTOR_ID"
      ON "lessons" ("tutor_id")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "lessons"
          ADD CONSTRAINT "FK_lessons_tutor_id"
          FOREIGN KEY ("tutor_id") REFERENCES "tutors"("id")
          ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lessons" DROP CONSTRAINT IF EXISTS "FK_lessons_tutor_id"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_LESSON_TUTOR_ID"`);
    await queryRunner.query(`
      ALTER TABLE "lessons" DROP COLUMN IF EXISTS "tutor_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "FK_students_assigned_tutor_id"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_STUDENT_ASSIGNED_TUTOR_ID"`);
    await queryRunner.query(`
      ALTER TABLE "students" DROP COLUMN IF EXISTS "assigned_tutor_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "tutors" DROP CONSTRAINT IF EXISTS "FK_tutors_user_id"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_TUTOR_EMAIL"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_TUTOR_USER_ID"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tutors"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tutors_status_enum"`);
  }
}
