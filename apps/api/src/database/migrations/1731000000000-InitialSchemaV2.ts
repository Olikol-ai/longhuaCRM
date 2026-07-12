import { MigrationInterface, QueryRunner } from 'typeorm';
import { alignLegacyTablesForV2, createIndexIfColumnsExist } from '../migration-helpers';

export class InitialSchemaV21731000000000 implements MigrationInterface {
  name = 'InitialSchemaV21731000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY,
        "email" varchar NOT NULL UNIQUE,
        "password_hash" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT '',
        "status" varchar NOT NULL DEFAULT 'pending',
        "email_verified" boolean NOT NULL DEFAULT false,
        "verification_code" text,
        "verification_attempts" int NOT NULL DEFAULT 0,
        "verification_code_expires_at" timestamptz,
        "verification_code_sent_at" timestamptz,
        "first_name" varchar NOT NULL DEFAULT '',
        "last_name" varchar NOT NULL DEFAULT '',
        "phone" varchar NOT NULL DEFAULT '',
        "telegram_id" varchar NOT NULL DEFAULT '',
        "telegram_username" varchar NOT NULL DEFAULT '',
        "telegram_link_token" text,
        "telegram_link_expires" timestamptz,
        "created_date" timestamptz NOT NULL DEFAULT now(),
        "updated_date" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pending_registrations" (
        "id" uuid PRIMARY KEY,
        "email" varchar NOT NULL UNIQUE,
        "password_hash" varchar NOT NULL,
        "first_name" varchar NOT NULL DEFAULT '',
        "last_name" varchar NOT NULL DEFAULT '',
        "phone" varchar NOT NULL DEFAULT '',
        "verification_code_hash" text,
        "code_expires_at" timestamptz,
        "last_sent_at" timestamptz,
        "send_count" int NOT NULL DEFAULT 0,
        "verification_attempts" int NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'pending',
        "expires_at" timestamptz NOT NULL,
        "created_date" timestamptz NOT NULL DEFAULT now(),
        "updated_date" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teachers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid UNIQUE REFERENCES "users"("id") ON DELETE SET NULL,
        "name" text NOT NULL,
        "first_name" text,
        "last_name" text,
        "email" text,
        "phone" text,
        "telegram_id" text,
        "hourly_rate" numeric,
        "specializations" text,
        "status" varchar NOT NULL DEFAULT 'active',
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "students" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid UNIQUE REFERENCES "users"("id") ON DELETE SET NULL,
        "name" text NOT NULL,
        "first_name" text,
        "last_name" text,
        "email" text UNIQUE,
        "phone" text,
        "telegram_id" text,
        "assigned_teacher_id" uuid REFERENCES "teachers"("id") ON DELETE SET NULL,
        "lesson_balance" int NOT NULL DEFAULT 0,
        "start_date" date,
        "birthday" date,
        "notes" text,
        "status" varchar NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_templates" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "course_type" varchar NOT NULL,
        "total_lessons" int NOT NULL DEFAULT 35,
        "description" text,
        "price" numeric(10,2) NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "enrollments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        "course_template_id" uuid REFERENCES "course_templates"("id") ON DELETE SET NULL,
        "course_name" text,
        "completed_lessons" int NOT NULL DEFAULT 0,
        "missed_lessons" int NOT NULL DEFAULT 0,
        "total_lessons" int NOT NULL DEFAULT 35,
        "status" varchar NOT NULL DEFAULT 'active',
        "start_date" date,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "groups" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "teacher_id" uuid NOT NULL REFERENCES "teachers"("id") ON DELETE RESTRICT,
        "name" text NOT NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "group_members" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE("group_id", "student_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_series" (
        "id" uuid PRIMARY KEY,
        "course_id" uuid REFERENCES "course_templates"("id") ON DELETE SET NULL,
        "group_id" uuid REFERENCES "groups"("id") ON DELETE SET NULL,
        "teacher_id" uuid NOT NULL REFERENCES "teachers"("id") ON DELETE RESTRICT,
        "start_date" date NOT NULL,
        "start_time" time NOT NULL,
        "frequency" varchar NOT NULL DEFAULT 'weekly',
        "total_lessons" int NOT NULL DEFAULT 35,
        "status" varchar NOT NULL DEFAULT 'active',
        "duration" int NOT NULL DEFAULT 60,
        "lesson_format" varchar NOT NULL DEFAULT 'online',
        "meeting_link" text,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teacher_availability_slots" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "teacher_id" uuid NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
        "day_of_week" smallint NOT NULL,
        "time_from" time NOT NULL,
        "time_to" time NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lessons" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "teacher_id" uuid NOT NULL REFERENCES "teachers"("id") ON DELETE RESTRICT,
        "series_id" uuid REFERENCES "lesson_series"("id") ON DELETE SET NULL,
        "group_id" uuid REFERENCES "groups"("id") ON DELETE SET NULL,
        "primary_student_id" uuid REFERENCES "students"("id") ON DELETE SET NULL,
        "date" date NOT NULL,
        "start_time" time NOT NULL,
        "duration" int NOT NULL DEFAULT 60,
        "status" varchar NOT NULL DEFAULT 'planned',
        "lesson_type" varchar NOT NULL DEFAULT 'individual',
        "lesson_format" varchar NOT NULL DEFAULT 'online',
        "meeting_link" text,
        "reminder_24h_sent" boolean NOT NULL DEFAULT false,
        "reminder_2h_sent" boolean NOT NULL DEFAULT false,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_series_students" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "series_id" uuid NOT NULL REFERENCES "lesson_series"("id") ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        UNIQUE("series_id", "student_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_series_exclusions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "series_id" uuid NOT NULL REFERENCES "lesson_series"("id") ON DELETE CASCADE,
        "exclusion_date" date NOT NULL,
        UNIQUE("series_id", "exclusion_date")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teacher_availability_bookings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "teacher_id" uuid NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
        "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
        "date" date NOT NULL,
        "time_from" time NOT NULL,
        "time_to" time NOT NULL,
        "status" varchar NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "attendance_records" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
        "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        "attendance_status" varchar NOT NULL DEFAULT 'enrolled',
        "balance_deducted" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE("lesson_id", "student_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shop_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "type" varchar NOT NULL,
        "lessons_count" int NOT NULL DEFAULT 0,
        "price" numeric(10,2) NOT NULL DEFAULT 0,
        "course_template_id" uuid REFERENCES "course_templates"("id") ON DELETE SET NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
        "amount" numeric(10,2) NOT NULL,
        "currency" text DEFAULT 'BYN',
        "status" varchar NOT NULL DEFAULT 'pending',
        "provider" varchar NOT NULL DEFAULT 'manual',
        "shop_item_id" uuid REFERENCES "shop_items"("id") ON DELETE SET NULL,
        "enrollment_id" uuid REFERENCES "enrollments"("id") ON DELETE SET NULL,
        "lessons_added" int NOT NULL DEFAULT 0,
        "payment_date" date,
        "order_number" text,
        "external_id" text,
        "paid_at" timestamptz,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_PAYMENTS_ORDER_NUMBER" UNIQUE ("order_number")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "material_folders" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "parent_id" uuid REFERENCES "material_folders"("id") ON DELETE CASCADE,
        "course_template_id" uuid REFERENCES "course_templates"("id") ON DELETE SET NULL,
        "name" text NOT NULL,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "materials" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "folder_id" uuid NOT NULL REFERENCES "material_folders"("id") ON DELETE CASCADE,
        "title" text NOT NULL,
        "file_url" text,
        "file_type" varchar,
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "material_access" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "material_id" uuid NOT NULL REFERENCES "materials"("id") ON DELETE CASCADE,
        "access" boolean NOT NULL DEFAULT true,
        "granted_by_role" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE("user_id", "material_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "material_links" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
        "material_id" uuid NOT NULL REFERENCES "materials"("id") ON DELETE CASCADE,
        UNIQUE("lesson_id", "material_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "certificates" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
        "course_id" uuid NOT NULL REFERENCES "course_templates"("id") ON DELETE RESTRICT,
        "registration_number" text NOT NULL UNIQUE,
        "blank_series" text,
        "blank_number" text,
        "issue_date" date,
        "status" varchar NOT NULL DEFAULT 'draft',
        "recipient_signature" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

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

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "channel" varchar NOT NULL,
        "type" varchar NOT NULL,
        "title" text NOT NULL,
        "body" text,
        "status" varchar NOT NULL DEFAULT 'pending',
        "read_at" timestamptz,
        "sent_at" timestamptz,
        "reference_type" varchar,
        "reference_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_settings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "key" varchar NOT NULL UNIQUE,
        "value" text NOT NULL DEFAULT '',
        "description" text,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "actor_user_id" uuid,
        "action" varchar NOT NULL,
        "entity_type" varchar NOT NULL,
        "entity_id" varchar,
        "summary" text,
        "created_date" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await alignLegacyTablesForV2(queryRunner);

    await createIndexIfColumnsExist(queryRunner, 'IDX_TEACHER_EMAIL', 'teachers', ['email'], '"email" IS NOT NULL');
    await createIndexIfColumnsExist(queryRunner, 'IDX_TEACHER_USER_ID', 'teachers', ['user_id'], '"user_id" IS NOT NULL');
    await createIndexIfColumnsExist(queryRunner, 'IDX_STUDENT_EMAIL', 'students', ['email'], '"email" IS NOT NULL');
    await createIndexIfColumnsExist(queryRunner, 'IDX_STUDENT_USER_ID', 'students', ['user_id'], '"user_id" IS NOT NULL');
    await createIndexIfColumnsExist(queryRunner, 'IDX_STUDENT_ASSIGNED_TEACHER_ID', 'students', ['assigned_teacher_id']);
    await createIndexIfColumnsExist(queryRunner, 'IDX_GROUP_TEACHER_ID', 'groups', ['teacher_id']);
    await createIndexIfColumnsExist(queryRunner, 'IDX_LESSON_TEACHER_ID', 'lessons', ['teacher_id']);
    await createIndexIfColumnsExist(queryRunner, 'IDX_LESSON_SERIES_ID', 'lessons', ['series_id']);
    await createIndexIfColumnsExist(queryRunner, 'IDX_LESSON_GROUP_ID', 'lessons', ['group_id']);
    await createIndexIfColumnsExist(queryRunner, 'IDX_LESSON_PRIMARY_STUDENT_ID', 'lessons', ['primary_student_id']);
    await createIndexIfColumnsExist(queryRunner, 'IDX_AVAILABILITY_BOOKING_TEACHER_ID', 'teacher_availability_bookings', ['teacher_id']);
    await createIndexIfColumnsExist(queryRunner, 'IDX_AVAILABILITY_BOOKING_LESSON_ID', 'teacher_availability_bookings', ['lesson_id']);
    await createIndexIfColumnsExist(
      queryRunner,
      'IDX_AVAILABILITY_BOOKING_TEACHER_DATE',
      'teacher_availability_bookings',
      ['teacher_id', 'date'],
    );
    await createIndexIfColumnsExist(queryRunner, 'IDX_PAYMENT_STUDENT_ID', 'payments', ['student_id']);
    await createIndexIfColumnsExist(queryRunner, 'IDX_PAYMENT_SHOP_ITEM_ID', 'payments', ['shop_item_id']);
    await createIndexIfColumnsExist(queryRunner, 'IDX_PAYMENT_ENROLLMENT_ID', 'payments', ['enrollment_id']);
    await createIndexIfColumnsExist(queryRunner, 'IDX_PAYMENT_PAYMENT_DATE', 'payments', ['payment_date']);
    await createIndexIfColumnsExist(queryRunner, 'IDX_MATERIAL_FOLDER_ID', 'materials', ['folder_id']);
    await createIndexIfColumnsExist(queryRunner, 'IDX_MATERIAL_ACCESS_USER_ID', 'material_access', ['user_id']);
    await createIndexIfColumnsExist(queryRunner, 'IDX_MATERIAL_ACCESS_MATERIAL_ID', 'material_access', ['material_id']);
    await createIndexIfColumnsExist(queryRunner, 'IDX_CERTIFICATE_STUDENT_ID', 'certificates', ['student_id']);
    await createIndexIfColumnsExist(queryRunner, 'IDX_CERTIFICATE_COURSE_ID', 'certificates', ['course_id']);
    await createIndexIfColumnsExist(
      queryRunner,
      'IDX_CERTIFICATE_HISTORY_CERTIFICATE_ID',
      'certificate_history',
      ['certificate_id'],
    );
    await createIndexIfColumnsExist(queryRunner, 'IDX_TEACHER_PAYMENT_TEACHER_ID', 'teacher_payments', ['teacher_id']);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'audit_logs', 'app_settings', 'notifications', 'certificate_history', 'certificates',
      'teacher_payments', 'material_links', 'material_access', 'materials', 'material_folders',
      'payments', 'shop_items', 'attendance_records', 'teacher_availability_bookings',
      'lesson_series_exclusions', 'lesson_series_students', 'lessons',
      'teacher_availability_slots', 'lesson_series', 'group_members', 'groups',
      'enrollments', 'course_templates', 'students', 'teachers',
      'pending_registrations', 'users',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
  }
}
