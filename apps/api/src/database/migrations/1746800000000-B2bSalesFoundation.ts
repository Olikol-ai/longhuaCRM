import { MigrationInterface, QueryRunner } from 'typeorm';

export class B2bSalesFoundation1746800000000 implements MigrationInterface {
  name = 'B2bSalesFoundation1746800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name text NOT NULL,
        unp varchar(32) NULL,
        sales_manager_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        status varchar(16) NOT NULL DEFAULT 'active',
        notes text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ORGANIZATION_UNP ON organizations (unp)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ORGANIZATION_SALES_MANAGER
      ON organizations (sales_manager_user_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sales_manager_profiles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        commission_percent numeric(5,2) NOT NULL DEFAULT 0,
        status varchar(16) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE groups
        ADD COLUMN IF NOT EXISTS organization_id uuid NULL
          REFERENCES organizations(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_GROUP_ORGANIZATION_ID ON groups (organization_id)
    `);
    await queryRunner.query(`
      ALTER TABLE groups
        ADD COLUMN IF NOT EXISTS contract_amount numeric(12,2) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE groups
        ADD COLUMN IF NOT EXISTS contract_currency varchar(8) NOT NULL DEFAULT 'BYN'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organization_receipts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        group_id uuid NULL REFERENCES groups(id) ON DELETE SET NULL,
        amount numeric(12,2) NOT NULL,
        currency varchar(8) NOT NULL DEFAULT 'BYN',
        received_at timestamptz NULL,
        status varchar(16) NOT NULL DEFAULT 'received',
        purpose text NULL,
        sales_manager_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        created_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ORG_RECEIPT_ORGANIZATION
      ON organization_receipts (organization_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ORG_RECEIPT_GROUP ON organization_receipts (group_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sales_commission_payouts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        manager_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        amount numeric(12,2) NOT NULL,
        currency varchar(8) NOT NULL DEFAULT 'BYN',
        paid_at timestamptz NOT NULL,
        notes text NULL,
        created_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_SALES_COMMISSION_PAYOUT_MANAGER
      ON sales_commission_payouts (manager_user_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sales_commission_accruals (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        receipt_id uuid NOT NULL UNIQUE REFERENCES organization_receipts(id) ON DELETE RESTRICT,
        manager_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        rate_percent numeric(5,2) NOT NULL,
        commission_amount numeric(12,2) NOT NULL,
        currency varchar(8) NOT NULL DEFAULT 'BYN',
        status varchar(16) NOT NULL DEFAULT 'accrued',
        payout_id uuid NULL REFERENCES sales_commission_payouts(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_SALES_COMMISSION_MANAGER
      ON sales_commission_accruals (manager_user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS sales_commission_accruals`);
    await queryRunner.query(`DROP TABLE IF EXISTS sales_commission_payouts`);
    await queryRunner.query(`DROP TABLE IF EXISTS organization_receipts`);
    await queryRunner.query(`ALTER TABLE groups DROP COLUMN IF EXISTS contract_currency`);
    await queryRunner.query(`ALTER TABLE groups DROP COLUMN IF EXISTS contract_amount`);
    await queryRunner.query(`ALTER TABLE groups DROP COLUMN IF EXISTS organization_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS sales_manager_profiles`);
    await queryRunner.query(`DROP TABLE IF EXISTS organizations`);
  }
}
