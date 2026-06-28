import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateJsonbData1730000000002 implements MigrationInterface {
  name = 'MigrateJsonbData1730000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "students" SET
        "name" = COALESCE(NULLIF(data->>'name', ''), 'Unknown'),
        "first_name" = NULLIF(data->>'first_name', ''),
        "last_name" = NULLIF(data->>'last_name', ''),
        "email" = NULLIF(data->>'email', ''),
        "phone" = NULLIF(data->>'phone', ''),
        "telegram_id" = NULLIF(data->>'telegram_id', ''),
        "assigned_teacher" = NULLIF(data->>'assigned_teacher', '')::uuid,
        "lesson_balance" = COALESCE(NULLIF(data->>'lesson_balance', '')::int, 0),
        "start_date" = NULLIF(data->>'start_date', '')::date,
        "birthday" = NULLIF(data->>'birthday', '')::date,
        "notes" = NULLIF(data->>'notes', ''),
        "status" = COALESCE(NULLIF(data->>'status', ''), 'active')::students_status_enum,
        "user_id" = NULLIF(data->>'user_id', '')::uuid
      WHERE data IS NOT NULL AND data <> '{}'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "teachers" SET
        "name" = COALESCE(NULLIF(data->>'name', ''), 'Unknown'),
        "first_name" = NULLIF(data->>'first_name', ''),
        "last_name" = NULLIF(data->>'last_name', ''),
        "email" = NULLIF(data->>'email', ''),
        "hourly_rate" = NULLIF(data->>'hourly_rate', '')::numeric,
        "telegram_id" = NULLIF(data->>'telegram_id', ''),
        "status" = COALESCE(NULLIF(data->>'status', ''), 'active')::teachers_status_enum,
        "specializations" = NULLIF(data->>'specializations', ''),
        "user_id" = NULLIF(data->>'user_id', '')::uuid
      WHERE data IS NOT NULL AND data <> '{}'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "lessons" SET
        "schedule_slot_id" = NULLIF(data->>'schedule_slot_id', '')::uuid,
        "teacher_id" = NULLIF(data->>'teacher_id', '')::uuid,
        "teacher_name" = NULLIF(data->>'teacher_name', ''),
        "teacher_first_name" = NULLIF(data->>'teacher_first_name', ''),
        "teacher_last_name" = NULLIF(data->>'teacher_last_name', ''),
        "student_id" = NULLIF(data->>'student_id', '')::uuid,
        "student_name" = NULLIF(data->>'student_name', ''),
        "student_first_name" = NULLIF(data->>'student_first_name', ''),
        "student_last_name" = NULLIF(data->>'student_last_name', ''),
        "student_ids" = CASE
          WHEN jsonb_typeof(data->'student_ids') = 'array'
            THEN array_to_string(ARRAY(SELECT jsonb_array_elements_text(data->'student_ids')), ',')
          ELSE NULLIF(data->>'student_ids', '')
        END,
        "student_names" = CASE
          WHEN jsonb_typeof(data->'student_names') = 'array'
            THEN array_to_string(ARRAY(SELECT jsonb_array_elements_text(data->'student_names')), ',')
          ELSE NULLIF(data->>'student_names', '')
        END,
        "date" = NULLIF(data->>'date', '')::date,
        "start_time" = NULLIF(data->>'start_time', '')::time,
        "duration" = COALESCE(NULLIF(data->>'duration', '')::int, 60),
        "meeting_link" = NULLIF(data->>'meeting_link', ''),
        "status" = COALESCE(NULLIF(data->>'status', ''), 'planned')::lessons_status_enum,
        "lesson_format" = COALESCE(NULLIF(data->>'lesson_format', ''), 'online')::lessons_lesson_format_enum,
        "lesson_type" = COALESCE(NULLIF(data->>'lesson_type', ''), 'individual')::lessons_lesson_type_enum,
        "lesson_topic" = NULLIF(data->>'lesson_topic', ''),
        "notes" = NULLIF(data->>'notes', ''),
        "is_recurring" = COALESCE((data->>'is_recurring')::boolean, false),
        "recurring_group_id" = NULLIF(data->>'recurring_group_id', '')::uuid,
        "material_ids" = CASE
          WHEN jsonb_typeof(data->'material_ids') = 'array'
            THEN array_to_string(ARRAY(SELECT jsonb_array_elements_text(data->'material_ids')), ',')
          ELSE NULLIF(data->>'material_ids', '')
        END,
        "balance_deducted" = COALESCE((data->>'balance_deducted')::boolean, false),
        "teacher_payment_id" = NULLIF(data->>'teacher_payment_id', '')::uuid,
        "reminder_24h_sent" = COALESCE((data->>'reminder_24h_sent')::boolean, false),
        "reminder_2h_sent" = COALESCE((data->>'reminder_2h_sent')::boolean, false)
      WHERE data IS NOT NULL AND data <> '{}'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "payments" SET
        "student_id" = NULLIF(data->>'student_id', '')::uuid,
        "lesson_id" = NULLIF(data->>'lesson_id', '')::uuid,
        "course_id" = NULLIF(data->>'course_id', '')::uuid,
        "amount" = NULLIF(data->>'amount', '')::numeric(10,2),
        "currency" = NULLIF(data->>'currency', ''),
        "status" = COALESCE(NULLIF(data->>'status', ''), 'pending')::payments_status_enum,
        "provider" = COALESCE(NULLIF(data->>'provider', ''), 'manual')::payments_provider_enum,
        "external_id" = NULLIF(data->>'external_id', ''),
        "paid_at" = COALESCE(
          NULLIF(data->>'paid_at', '')::timestamptz,
          NULLIF(data->>'payment_date', '')::timestamptz
        ),
        "notes" = NULLIF(data->>'notes', '')
      WHERE data IS NOT NULL AND data <> '{}'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "courses" SET
        "student_id" = NULLIF(data->>'student_id', '')::uuid,
        "student_name" = NULLIF(data->>'student_name', ''),
        "course_type" = COALESCE(
          NULLIF(data->>'course_type', ''),
          NULLIF(data->>'courseType', '')
        )::courses_course_type_enum,
        "course_name" = NULLIF(data->>'course_name', ''),
        "total_lessons" = COALESCE(NULLIF(data->>'total_lessons', '')::int, 35),
        "completed_lessons" = COALESCE(NULLIF(data->>'completed_lessons', '')::int, 0),
        "start_date" = NULLIF(data->>'start_date', '')::date,
        "status" = COALESCE(NULLIF(data->>'status', ''), 'active')::courses_status_enum,
        "notes" = NULLIF(data->>'notes', '')
      WHERE data IS NOT NULL AND data <> '{}'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "lesson_materials" SET
        "title" = COALESCE(NULLIF(data->>'title', ''), 'Untitled'),
        "description" = NULLIF(data->>'description', ''),
        "file_url" = COALESCE(NULLIF(data->>'file_url', ''), ''),
        "file_type" = COALESCE(NULLIF(data->>'file_type', ''), 'other')::lesson_materials_file_type_enum,
        "course_id" = NULLIF(data->>'course_id', '')::uuid,
        "block_name" = NULLIF(data->>'block_name', ''),
        "tags" = CASE
          WHEN jsonb_typeof(data->'tags') = 'array'
            THEN array_to_string(ARRAY(SELECT jsonb_array_elements_text(data->'tags')), ',')
          ELSE NULLIF(data->>'tags', '')
        END
      WHERE data IS NOT NULL AND data <> '{}'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "schedule_slots" SET
        "teacher_id" = NULLIF(data->>'teacher_id', '')::uuid,
        "date" = NULLIF(data->>'date', '')::date,
        "start_time" = NULLIF(data->>'start_time', '')::time,
        "duration" = COALESCE(NULLIF(data->>'duration', '')::int, 60),
        "lesson_type" = COALESCE(NULLIF(data->>'lesson_type', ''), 'individual')::schedule_slots_lesson_type_enum,
        "format" = COALESCE(NULLIF(data->>'format', ''), 'online')::schedule_slots_format_enum,
        "status" = COALESCE(NULLIF(data->>'status', ''), 'open')::schedule_slots_status_enum,
        "recurring_group_id" = NULLIF(data->>'recurring_group_id', '')::uuid,
        "meeting_link" = NULLIF(data->>'meeting_link', '')
      WHERE data IS NOT NULL AND data <> '{}'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "lesson_students" SET
        "lesson_id" = NULLIF(data->>'lesson_id', '')::uuid,
        "student_id" = NULLIF(data->>'student_id', '')::uuid,
        "attendance_status" = COALESCE(NULLIF(data->>'attendance_status', ''), 'enrolled')::lesson_students_attendance_status_enum,
        "balance_deducted" = COALESCE((data->>'balance_deducted')::boolean, false)
      WHERE data IS NOT NULL AND data <> '{}'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "lesson_balances" SET
        "student_id" = NULLIF(data->>'student_id', '')::uuid,
        "lessons_available" = COALESCE(NULLIF(data->>'lessons_available', '')::int, 0),
        "lessons_used" = COALESCE(NULLIF(data->>'lessons_used', '')::int, 0)
      WHERE data IS NOT NULL AND data <> '{}'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "teacher_payments" SET
        "teacher_id" = NULLIF(data->>'teacher_id', '')::uuid,
        "lesson_id" = NULLIF(data->>'lesson_id', '')::uuid,
        "amount" = NULLIF(data->>'amount', '')::numeric(10,2),
        "status" = COALESCE(NULLIF(data->>'status', ''), 'pending')::teacher_payments_status_enum,
        "note" = NULLIF(data->>'note', '')
      WHERE data IS NOT NULL AND data <> '{}'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "material_access" SET
        "user_id" = NULLIF(data->>'user_id', '')::uuid,
        "material_id" = NULLIF(data->>'material_id', '')::uuid,
        "granted_by_role" = NULLIF(data->>'granted_by_role', '')::material_access_granted_by_role_enum,
        "access" = COALESCE((data->>'access')::boolean, false),
        "notes" = NULLIF(data->>'notes', '')
      WHERE data IS NOT NULL AND data <> '{}'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "teacher_availability" SET
        "teacher_id" = NULLIF(data->>'teacher_id', '')::uuid,
        "slots" = CASE
          WHEN jsonb_typeof(data->'slots') = 'array' THEN data->'slots'
          ELSE NULL
        END
      WHERE data IS NOT NULL AND data <> '{}'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "alfa_bank_orders" SET
        "student_id" = NULLIF(data->>'student_id', '')::uuid,
        "order_number" = COALESCE(NULLIF(data->>'order_number', ''), id::text),
        "alfa_order_id" = NULLIF(data->>'alfa_order_id', ''),
        "type" = NULLIF(data->>'type', '')::alfa_bank_orders_type_enum,
        "item_id" = NULLIF(data->>'item_id', '')::uuid,
        "amount" = NULLIF(data->>'amount', '')::numeric(10,2),
        "status" = COALESCE(NULLIF(data->>'status', ''), 'pending')::alfa_bank_orders_status_enum,
        "payment_date" = NULLIF(data->>'payment_date', '')::timestamptz,
        "notes" = NULLIF(data->>'notes', '')
      WHERE data IS NOT NULL AND data <> '{}'::jsonb
    `);

    for (const table of ['app_settings', 'shop_settings', 'welcome_page_settings']) {
      const keyExpr =
        table === 'shop_settings'
          ? `COALESCE(NULLIF(data->>'key', ''), NULLIF(data->>'item_id', ''), id::text)`
          : `COALESCE(NULLIF(data->>'key', ''), id::text)`;

      await queryRunner.query(`
        UPDATE "${table}" SET
          "key" = ${keyExpr},
          "value" = NULLIF(data->>'value', ''),
          "description" = NULLIF(data->>'description', ''),
          "type" = NULLIF(data->>'type', ''),
          "is_active" = COALESCE((data->>'is_active')::boolean, (data->>'isActive')::boolean, true)
        WHERE data IS NOT NULL AND data <> '{}'::jsonb
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
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

    for (const table of tables) {
      await queryRunner.query(`
        UPDATE "${table}" SET data = '{}'::jsonb
      `);
    }
  }
}
