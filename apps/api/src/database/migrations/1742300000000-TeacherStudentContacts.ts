import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Private local student contacts for teachers (and tutors via owner_type).
 * Not CRM Students / Users — scheduling notebook only.
 */
export class TeacherStudentContacts1742300000000 implements MigrationInterface {
  name = 'TeacherStudentContacts1742300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "teacher_student_contacts_owner_type_enum" AS ENUM ('teacher', 'tutor');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teacher_student_contacts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "owner_type" "teacher_student_contacts_owner_type_enum" NOT NULL,
        "owner_id" uuid NOT NULL,
        "name" text NOT NULL,
        "phone" text,
        "comment" text,
        "linked_student_id" uuid,
        "status" text NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teacher_student_contacts" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_teacher_student_contacts_status"
          CHECK ("status" IN ('active', 'inactive'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TEACHER_STUDENT_CONTACTS_OWNER"
      ON "teacher_student_contacts" ("owner_type", "owner_id")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "teacher_student_contacts"
          ADD CONSTRAINT "FK_teacher_student_contacts_linked_student"
          FOREIGN KEY ("linked_student_id") REFERENCES "students"("id")
          ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "lessons"
        ADD COLUMN IF NOT EXISTS "primary_teacher_student_contact_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_LESSON_PRIMARY_TEACHER_STUDENT_CONTACT_ID"
      ON "lessons" ("primary_teacher_student_contact_id")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "lessons"
          ADD CONSTRAINT "FK_lessons_primary_teacher_student_contact"
          FOREIGN KEY ("primary_teacher_student_contact_id")
          REFERENCES "teacher_student_contacts"("id")
          ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lessons"
        DROP CONSTRAINT IF EXISTS "FK_lessons_primary_teacher_student_contact"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_LESSON_PRIMARY_TEACHER_STUDENT_CONTACT_ID"
    `);
    await queryRunner.query(`
      ALTER TABLE "lessons"
        DROP COLUMN IF EXISTS "primary_teacher_student_contact_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "teacher_student_contacts"
        DROP CONSTRAINT IF EXISTS "FK_teacher_student_contacts_linked_student"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "teacher_student_contacts"`);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "teacher_student_contacts_owner_type_enum"
    `);
  }
}
