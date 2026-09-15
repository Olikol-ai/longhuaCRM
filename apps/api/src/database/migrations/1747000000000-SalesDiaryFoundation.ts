import { MigrationInterface, QueryRunner } from 'typeorm';

export class SalesDiaryFoundation1747000000000 implements MigrationInterface {
  name = 'SalesDiaryFoundation1747000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sales_diary_entries (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
        sales_manager_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        status varchar(32) NOT NULL DEFAULT 'new',
        next_contact_at timestamptz NULL,
        potential_students_count int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_SALES_DIARY_ENTRY_MANAGER
      ON sales_diary_entries (sales_manager_user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_SALES_DIARY_ENTRY_NEXT_CONTACT
      ON sales_diary_entries (next_contact_at)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sales_diary_notes (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        entry_id uuid NOT NULL REFERENCES sales_diary_entries(id) ON DELETE CASCADE,
        sales_manager_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        note text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_SALES_DIARY_NOTE_ENTRY
      ON sales_diary_notes (entry_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sales_diary_contacts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        entry_id uuid NOT NULL REFERENCES sales_diary_entries(id) ON DELETE CASCADE,
        sales_manager_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        contact_type varchar(16) NOT NULL,
        contacted_at timestamptz NOT NULL,
        result varchar(512) NULL,
        next_contact_at timestamptz NULL,
        comment text NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_SALES_DIARY_CONTACT_ENTRY
      ON sales_diary_contacts (entry_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organization_deals (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        entry_id uuid NULL REFERENCES sales_diary_entries(id) ON DELETE SET NULL,
        sales_manager_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        group_id uuid NULL REFERENCES groups(id) ON DELETE SET NULL,
        students_count int NOT NULL,
        price_per_student numeric(12,2) NULL,
        amount numeric(12,2) NOT NULL,
        currency varchar(8) NOT NULL DEFAULT 'BYN',
        contract_date date NULL,
        start_date date NULL,
        status varchar(16) NOT NULL DEFAULT 'signed',
        comment text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ORGANIZATION_DEAL_ORG
      ON organization_deals (organization_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ORGANIZATION_DEAL_MANAGER
      ON organization_deals (sales_manager_user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS organization_deals`);
    await queryRunner.query(`DROP TABLE IF EXISTS sales_diary_contacts`);
    await queryRunner.query(`DROP TABLE IF EXISTS sales_diary_notes`);
    await queryRunner.query(`DROP TABLE IF EXISTS sales_diary_entries`);
  }
}
