import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase2BusinessFlow1732000000000 implements MigrationInterface {
  name = 'Phase2BusinessFlow1732000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teacher_payments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "teacher_id" uuid NOT NULL REFERENCES "teachers"("id") ON DELETE RESTRICT,
        "lesson_id" uuid NOT NULL UNIQUE REFERENCES "lessons"("id") ON DELETE CASCADE,
        "amount" numeric(10,2) NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'pending',
        "paid_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_TEACHER_PAYMENT_TEACHER_ID" ON "teacher_payments" ("teacher_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "certificate_history" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "certificate_id" uuid NOT NULL REFERENCES "certificates"("id") ON DELETE CASCADE,
        "action" text NOT NULL,
        "previous_status" varchar,
        "new_status" varchar,
        "actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_CERTIFICATE_HISTORY_CERTIFICATE_ID" ON "certificate_history" ("certificate_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_CERTIFICATE_HISTORY_ACTOR_USER_ID" ON "certificate_history" ("actor_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "certificate_history" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "certificates" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teacher_payments" CASCADE`);

    await queryRunner.query(`
      CREATE TABLE "certificates" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        "enrollment_id" uuid REFERENCES "enrollments"("id") ON DELETE SET NULL,
        "title" text NOT NULL,
        "issued_at" timestamptz NOT NULL DEFAULT now(),
        "file_url" text,
        "issued_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }
}
