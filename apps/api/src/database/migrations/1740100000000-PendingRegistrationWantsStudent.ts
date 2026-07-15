import { MigrationInterface, QueryRunner } from 'typeorm';

export class PendingRegistrationWantsStudent1740100000000
  implements MigrationInterface
{
  name = 'PendingRegistrationWantsStudent1740100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pending_registrations"
      ADD COLUMN IF NOT EXISTS "wants_student_role" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pending_registrations"
      DROP COLUMN IF EXISTS "wants_student_role"
    `);
  }
}
