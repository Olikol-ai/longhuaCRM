import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropJsonbColumn1730000000003 implements MigrationInterface {
  name = 'DropJsonbColumn1730000000003';

  private readonly jsonTables = [
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
    'teacher_availability',
    'alfa_bank_orders',
    'app_settings',
    'shop_settings',
    'welcome_page_settings',
  ];

  private readonly jsonIndexes = [
    'IDX_app_settings_key',
    'IDX_shop_settings_item_id',
    'IDX_lessons_date_status',
    'IDX_payments_student_date',
  ];

  private readonly foreignKeyConstraints = [
    'FK_students_assigned_teacher',
    'FK_students_user_id',
    'FK_teachers_user_id',
    'FK_lessons_schedule_slot_id',
    'FK_lessons_teacher_id',
    'FK_lessons_student_id',
    'FK_payments_student_id',
    'FK_payments_lesson_id',
    'FK_payments_course_id',
    'FK_courses_student_id',
    'FK_lesson_materials_course_id',
    'FK_schedule_slots_teacher_id',
    'FK_lesson_students_lesson_id',
    'FK_lesson_students_student_id',
    'FK_lesson_balances_student_id',
    'FK_teacher_payments_teacher_id',
    'FK_teacher_payments_lesson_id',
    'FK_material_access_user_id',
    'FK_material_access_material_id',
    'FK_teacher_availability_teacher_id',
    'FK_alfa_bank_orders_student_id',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const index of this.jsonIndexes) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${index}"`);
    }

    for (const table of this.jsonTables) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "data"`);
    }

    for (const constraint of this.foreignKeyConstraints) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE IF EXISTS "students" VALIDATE CONSTRAINT "${constraint}";
          ALTER TABLE IF EXISTS "teachers" VALIDATE CONSTRAINT "${constraint}";
          ALTER TABLE IF EXISTS "lessons" VALIDATE CONSTRAINT "${constraint}";
          ALTER TABLE IF EXISTS "payments" VALIDATE CONSTRAINT "${constraint}";
          ALTER TABLE IF EXISTS "courses" VALIDATE CONSTRAINT "${constraint}";
          ALTER TABLE IF EXISTS "lesson_materials" VALIDATE CONSTRAINT "${constraint}";
          ALTER TABLE IF EXISTS "schedule_slots" VALIDATE CONSTRAINT "${constraint}";
          ALTER TABLE IF EXISTS "lesson_students" VALIDATE CONSTRAINT "${constraint}";
          ALTER TABLE IF EXISTS "lesson_balances" VALIDATE CONSTRAINT "${constraint}";
          ALTER TABLE IF EXISTS "teacher_payments" VALIDATE CONSTRAINT "${constraint}";
          ALTER TABLE IF EXISTS "material_access" VALIDATE CONSTRAINT "${constraint}";
          ALTER TABLE IF EXISTS "teacher_availability" VALIDATE CONSTRAINT "${constraint}";
          ALTER TABLE IF EXISTS "alfa_bank_orders" VALIDATE CONSTRAINT "${constraint}";
        EXCEPTION
          WHEN undefined_object THEN NULL;
          WHEN foreign_key_violation THEN NULL;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.jsonTables) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "data" jsonb NOT NULL DEFAULT '{}'::jsonb
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
}
