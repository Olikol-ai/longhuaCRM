import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeUserRoles1730000000007 implements MigrationInterface {
  name = 'NormalizeUserRoles1730000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users"
      SET "role" = ''
      WHERE "role" IN ('pending', 'user', 'pending-role')
        AND "role" NOT IN ('admin', 'teacher', 'student')
    `);

    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users"
      SET "role" = 'pending'
      WHERE "role" = '' OR "role" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'pending'
    `);
  }
}
