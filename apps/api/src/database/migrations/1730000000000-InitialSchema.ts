import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1730000000000 implements MigrationInterface {
  name = 'InitialSchema1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL,
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "role" character varying NOT NULL DEFAULT 'pending',
        "first_name" character varying NOT NULL DEFAULT '',
        "last_name" character varying NOT NULL DEFAULT '',
        "phone" character varying NOT NULL DEFAULT '',
        "telegram_id" character varying NOT NULL DEFAULT '',
        "created_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")`);

    const jsonTables = [
      'students',
      'teachers',
      'lessons',
      'payments',
      'courses',
      'lesson_materials',
      'schedule_slots',
      'lesson_students',
      'lesson_balances',
      'teacher_payments',
      'material_access',
      'teacher_availabilities',
      'alfa_bank_orders',
      'app_settings',
      'shop_settings',
      'welcome_page_settings',
    ];

    for (const table of jsonTables) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${table}" (
          "id" uuid NOT NULL,
          "data" jsonb NOT NULL DEFAULT '{}',
          "created_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "PK_${table}" PRIMARY KEY ("id")
        )
      `);
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_app_settings_key"
      ON "app_settings" ((data->>'key'))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_shop_settings_item_id"
      ON "shop_settings" ((data->>'item_id'))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lessons_date_status"
      ON "lessons" ((data->>'date'), (data->>'status'))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payments_student_date"
      ON "payments" ((data->>'student_id'), (data->>'payment_date'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const jsonTables = [
      'welcome_page_settings',
      'shop_settings',
      'app_settings',
      'alfa_bank_orders',
      'teacher_availabilities',
      'material_access',
      'teacher_payments',
      'lesson_balances',
      'lesson_students',
      'schedule_slots',
      'lesson_materials',
      'courses',
      'payments',
      'lessons',
      'teachers',
      'students',
    ];

    for (const table of jsonTables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
