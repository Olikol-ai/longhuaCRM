import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Peer sharing of homework templates between teachers/tutors.
 */
export class HomeworkAccess1746700000000 implements MigrationInterface {
  name = 'HomeworkAccess1746700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "homework_access" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "homework_id" uuid NOT NULL,
        "grantee_user_id" uuid NOT NULL,
        "granted_by_user_id" uuid NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_homework_access_homework"
          FOREIGN KEY ("homework_id") REFERENCES "homeworks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_homework_access_grantee"
          FOREIGN KEY ("grantee_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_homework_access_granted_by"
          FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_HOMEWORK_ACCESS_HW_GRANTEE"
          UNIQUE ("homework_id", "grantee_user_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_HOMEWORK_ACCESS_HOMEWORK_ID"
      ON "homework_access" ("homework_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_HOMEWORK_ACCESS_GRANTEE_USER_ID"
      ON "homework_access" ("grantee_user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "homework_access"`);
  }
}
