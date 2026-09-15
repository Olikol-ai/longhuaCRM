import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Align FKs so a user can be hard-deleted without wiping historical records.
 * - assessment_attempts.user_id is NOT NULL + ON DELETE SET NULL → not-null violation
 * - commission manager_user_id is RESTRICT → blocks sales_manager deletion
 */
export class UserDeletionFkAlign1746900000000 implements MigrationInterface {
  name = 'UserDeletionFkAlign1746900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE assessment_attempts
        ALTER COLUMN user_id DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE homework_attempts
        ALTER COLUMN user_id DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE sales_commission_accruals
        ALTER COLUMN manager_user_id DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE sales_commission_accruals
        DROP CONSTRAINT IF EXISTS sales_commission_accruals_manager_user_id_fkey
    `);
    await queryRunner.query(`
      ALTER TABLE sales_commission_accruals
        ADD CONSTRAINT sales_commission_accruals_manager_user_id_fkey
        FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE sales_commission_payouts
        ALTER COLUMN manager_user_id DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE sales_commission_payouts
        DROP CONSTRAINT IF EXISTS sales_commission_payouts_manager_user_id_fkey
    `);
    await queryRunner.query(`
      ALTER TABLE sales_commission_payouts
        ADD CONSTRAINT sales_commission_payouts_manager_user_id_fkey
        FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sales_commission_payouts
        DROP CONSTRAINT IF EXISTS sales_commission_payouts_manager_user_id_fkey
    `);
    await queryRunner.query(`
      ALTER TABLE sales_commission_payouts
        ALTER COLUMN manager_user_id SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE sales_commission_payouts
        ADD CONSTRAINT sales_commission_payouts_manager_user_id_fkey
        FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE sales_commission_accruals
        DROP CONSTRAINT IF EXISTS sales_commission_accruals_manager_user_id_fkey
    `);
    await queryRunner.query(`
      ALTER TABLE sales_commission_accruals
        ALTER COLUMN manager_user_id SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE sales_commission_accruals
        ADD CONSTRAINT sales_commission_accruals_manager_user_id_fkey
        FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE homework_attempts
        ALTER COLUMN user_id SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_attempts
        ALTER COLUMN user_id SET NOT NULL
    `);
  }
}
