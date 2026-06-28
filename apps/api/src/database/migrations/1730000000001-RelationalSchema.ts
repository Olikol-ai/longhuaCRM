import { MigrationInterface, QueryRunner } from 'typeorm';

export class RelationalSchema1730000000001 implements MigrationInterface {
  name = 'RelationalSchema1730000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createEnumTypes(queryRunner);
    await this.addRelationalColumns(queryRunner);
    await this.renameTeacherAvailability(queryRunner);
    await this.createIndexes(queryRunner);
    await this.createForeignKeys(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropForeignKeys(queryRunner);
    await this.dropIndexes(queryRunner);
    await this.dropRelationalColumns(queryRunner);
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "teacher_availability" RENAME TO "teacher_availabilities"`,
    );
    await this.dropEnumTypes(queryRunner);
  }

  private async createEnumTypes(queryRunner: QueryRunner): Promise<void> {
    const enums: Array<{ name: string; values: string[] }> = [
      { name: 'students_status_enum', values: ['active', 'inactive', 'paused'] },
      { name: 'teachers_status_enum', values: ['active', 'inactive'] },
      {
        name: 'lessons_status_enum',
        values: ['planned', 'completed', 'cancelled', 'rescheduled', 'missed', 'missed_no_notice'],
      },
      { name: 'lessons_lesson_format_enum', values: ['online', 'offline'] },
      { name: 'lessons_lesson_type_enum', values: ['individual', 'group'] },
      { name: 'payments_status_enum', values: ['pending', 'paid', 'failed', 'refunded'] },
      { name: 'payments_provider_enum', values: ['alfa_bank', 'cash', 'manual'] },
      {
        name: 'courses_course_type_enum',
        values: ['basic_beginner', 'advanced_beginner', 'advanced'],
      },
      { name: 'courses_status_enum', values: ['active', 'completed', 'paused'] },
      { name: 'lesson_materials_file_type_enum', values: ['pdf', 'pptx', 'video', 'link', 'other'] },
      { name: 'schedule_slots_lesson_type_enum', values: ['individual', 'group'] },
      { name: 'schedule_slots_format_enum', values: ['online', 'offline'] },
      { name: 'schedule_slots_status_enum', values: ['open', 'booked', 'cancelled'] },
      {
        name: 'lesson_students_attendance_status_enum',
        values: ['enrolled', 'attended', 'missed', 'missed_no_notice', 'cancelled'],
      },
      { name: 'teacher_payments_status_enum', values: ['pending', 'paid'] },
      { name: 'material_access_granted_by_role_enum', values: ['ADMIN', 'TEACHER'] },
      { name: 'alfa_bank_orders_type_enum', values: ['package', 'course'] },
      { name: 'alfa_bank_orders_status_enum', values: ['pending', 'paid', 'failed', 'cancelled'] },
    ];

    for (const enumType of enums) {
      const values = enumType.values.map((value) => `'${value}'`).join(', ');
      await queryRunner.query(`
        DO $$ BEGIN
          CREATE TYPE "${enumType.name}" AS ENUM (${values});
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }
  }

  private async addRelationalColumns(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "students"
        ADD COLUMN IF NOT EXISTS "name" text,
        ADD COLUMN IF NOT EXISTS "first_name" text,
        ADD COLUMN IF NOT EXISTS "last_name" text,
        ADD COLUMN IF NOT EXISTS "email" text,
        ADD COLUMN IF NOT EXISTS "phone" text,
        ADD COLUMN IF NOT EXISTS "telegram_id" text,
        ADD COLUMN IF NOT EXISTS "assigned_teacher" uuid,
        ADD COLUMN IF NOT EXISTS "lesson_balance" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "start_date" date,
        ADD COLUMN IF NOT EXISTS "birthday" date,
        ADD COLUMN IF NOT EXISTS "notes" text,
        ADD COLUMN IF NOT EXISTS "status" "students_status_enum" NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS "user_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "teachers"
        ADD COLUMN IF NOT EXISTS "name" text,
        ADD COLUMN IF NOT EXISTS "first_name" text,
        ADD COLUMN IF NOT EXISTS "last_name" text,
        ADD COLUMN IF NOT EXISTS "email" text,
        ADD COLUMN IF NOT EXISTS "hourly_rate" numeric,
        ADD COLUMN IF NOT EXISTS "telegram_id" text,
        ADD COLUMN IF NOT EXISTS "status" "teachers_status_enum" NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS "specializations" text,
        ADD COLUMN IF NOT EXISTS "user_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "lessons"
        ADD COLUMN IF NOT EXISTS "schedule_slot_id" uuid,
        ADD COLUMN IF NOT EXISTS "teacher_id" uuid,
        ADD COLUMN IF NOT EXISTS "teacher_name" text,
        ADD COLUMN IF NOT EXISTS "teacher_first_name" text,
        ADD COLUMN IF NOT EXISTS "teacher_last_name" text,
        ADD COLUMN IF NOT EXISTS "student_id" uuid,
        ADD COLUMN IF NOT EXISTS "student_name" text,
        ADD COLUMN IF NOT EXISTS "student_first_name" text,
        ADD COLUMN IF NOT EXISTS "student_last_name" text,
        ADD COLUMN IF NOT EXISTS "student_ids" text,
        ADD COLUMN IF NOT EXISTS "student_names" text,
        ADD COLUMN IF NOT EXISTS "date" date,
        ADD COLUMN IF NOT EXISTS "start_time" time,
        ADD COLUMN IF NOT EXISTS "duration" integer NOT NULL DEFAULT 60,
        ADD COLUMN IF NOT EXISTS "meeting_link" text,
        ADD COLUMN IF NOT EXISTS "status" "lessons_status_enum" NOT NULL DEFAULT 'planned',
        ADD COLUMN IF NOT EXISTS "lesson_format" "lessons_lesson_format_enum" NOT NULL DEFAULT 'online',
        ADD COLUMN IF NOT EXISTS "lesson_type" "lessons_lesson_type_enum" NOT NULL DEFAULT 'individual',
        ADD COLUMN IF NOT EXISTS "lesson_topic" text,
        ADD COLUMN IF NOT EXISTS "notes" text,
        ADD COLUMN IF NOT EXISTS "is_recurring" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "recurring_group_id" uuid,
        ADD COLUMN IF NOT EXISTS "material_ids" text,
        ADD COLUMN IF NOT EXISTS "balance_deducted" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "teacher_payment_id" uuid,
        ADD COLUMN IF NOT EXISTS "reminder_24h_sent" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "reminder_2h_sent" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "payments"
        ADD COLUMN IF NOT EXISTS "student_id" uuid,
        ADD COLUMN IF NOT EXISTS "lesson_id" uuid,
        ADD COLUMN IF NOT EXISTS "course_id" uuid,
        ADD COLUMN IF NOT EXISTS "amount" numeric(10,2),
        ADD COLUMN IF NOT EXISTS "currency" text,
        ADD COLUMN IF NOT EXISTS "status" "payments_status_enum" NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS "provider" "payments_provider_enum" NOT NULL DEFAULT 'manual',
        ADD COLUMN IF NOT EXISTS "external_id" text,
        ADD COLUMN IF NOT EXISTS "paid_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "notes" text
    `);

    await queryRunner.query(`
      ALTER TABLE "courses"
        ADD COLUMN IF NOT EXISTS "student_id" uuid,
        ADD COLUMN IF NOT EXISTS "student_name" text,
        ADD COLUMN IF NOT EXISTS "course_type" "courses_course_type_enum",
        ADD COLUMN IF NOT EXISTS "course_name" text,
        ADD COLUMN IF NOT EXISTS "total_lessons" integer NOT NULL DEFAULT 35,
        ADD COLUMN IF NOT EXISTS "completed_lessons" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "start_date" date,
        ADD COLUMN IF NOT EXISTS "status" "courses_status_enum" NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS "notes" text
    `);

    await queryRunner.query(`
      ALTER TABLE "lesson_materials"
        ADD COLUMN IF NOT EXISTS "title" text,
        ADD COLUMN IF NOT EXISTS "description" text,
        ADD COLUMN IF NOT EXISTS "file_url" text,
        ADD COLUMN IF NOT EXISTS "file_type" "lesson_materials_file_type_enum" NOT NULL DEFAULT 'other',
        ADD COLUMN IF NOT EXISTS "course_id" uuid,
        ADD COLUMN IF NOT EXISTS "block_name" text,
        ADD COLUMN IF NOT EXISTS "tags" text
    `);

    await queryRunner.query(`
      ALTER TABLE "schedule_slots"
        ADD COLUMN IF NOT EXISTS "teacher_id" uuid,
        ADD COLUMN IF NOT EXISTS "date" date,
        ADD COLUMN IF NOT EXISTS "start_time" time,
        ADD COLUMN IF NOT EXISTS "duration" integer NOT NULL DEFAULT 60,
        ADD COLUMN IF NOT EXISTS "lesson_type" "schedule_slots_lesson_type_enum" NOT NULL DEFAULT 'individual',
        ADD COLUMN IF NOT EXISTS "format" "schedule_slots_format_enum" NOT NULL DEFAULT 'online',
        ADD COLUMN IF NOT EXISTS "status" "schedule_slots_status_enum" NOT NULL DEFAULT 'open',
        ADD COLUMN IF NOT EXISTS "recurring_group_id" uuid,
        ADD COLUMN IF NOT EXISTS "meeting_link" text
    `);

    await queryRunner.query(`
      ALTER TABLE "lesson_students"
        ADD COLUMN IF NOT EXISTS "lesson_id" uuid,
        ADD COLUMN IF NOT EXISTS "student_id" uuid,
        ADD COLUMN IF NOT EXISTS "attendance_status" "lesson_students_attendance_status_enum" NOT NULL DEFAULT 'enrolled',
        ADD COLUMN IF NOT EXISTS "balance_deducted" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "lesson_balances"
        ADD COLUMN IF NOT EXISTS "student_id" uuid,
        ADD COLUMN IF NOT EXISTS "lessons_available" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "lessons_used" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_payments"
        ADD COLUMN IF NOT EXISTS "teacher_id" uuid,
        ADD COLUMN IF NOT EXISTS "lesson_id" uuid,
        ADD COLUMN IF NOT EXISTS "amount" numeric(10,2),
        ADD COLUMN IF NOT EXISTS "status" "teacher_payments_status_enum" NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS "note" text
    `);

    await queryRunner.query(`
      ALTER TABLE "material_access"
        ADD COLUMN IF NOT EXISTS "user_id" uuid,
        ADD COLUMN IF NOT EXISTS "material_id" uuid,
        ADD COLUMN IF NOT EXISTS "granted_by_role" "material_access_granted_by_role_enum",
        ADD COLUMN IF NOT EXISTS "access" boolean,
        ADD COLUMN IF NOT EXISTS "notes" text
    `);

    await queryRunner.query(`
      ALTER TABLE "alfa_bank_orders"
        ADD COLUMN IF NOT EXISTS "student_id" uuid,
        ADD COLUMN IF NOT EXISTS "order_number" character varying,
        ADD COLUMN IF NOT EXISTS "alfa_order_id" character varying,
        ADD COLUMN IF NOT EXISTS "type" "alfa_bank_orders_type_enum",
        ADD COLUMN IF NOT EXISTS "item_id" uuid,
        ADD COLUMN IF NOT EXISTS "amount" numeric(10,2),
        ADD COLUMN IF NOT EXISTS "status" "alfa_bank_orders_status_enum" NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS "payment_date" timestamptz,
        ADD COLUMN IF NOT EXISTS "notes" text
    `);

    for (const table of ['app_settings', 'shop_settings', 'welcome_page_settings']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ADD COLUMN IF NOT EXISTS "key" text,
          ADD COLUMN IF NOT EXISTS "value" text,
          ADD COLUMN IF NOT EXISTS "description" text,
          ADD COLUMN IF NOT EXISTS "type" text,
          ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true
      `);
    }
  }

  private async renameTeacherAvailability(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'teacher_availabilities'
        ) THEN
          ALTER TABLE "teacher_availabilities" RENAME TO "teacher_availability";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_availability"
        ADD COLUMN IF NOT EXISTS "teacher_id" uuid,
        ADD COLUMN IF NOT EXISTS "slots" jsonb
    `);
  }

  private async createIndexes(queryRunner: QueryRunner): Promise<void> {
    const indexes = [
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_STUDENT_EMAIL" ON "students" ("email")`,
      `CREATE INDEX IF NOT EXISTS "IDX_STUDENT_ASSIGNED_TEACHER" ON "students" ("assigned_teacher")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_TEACHER_EMAIL" ON "teachers" ("email")`,
      `CREATE INDEX IF NOT EXISTS "IDX_LESSON_SCHEDULE_SLOT_ID" ON "lessons" ("schedule_slot_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_LESSON_TEACHER_ID" ON "lessons" ("teacher_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_LESSON_PRIMARY_STUDENT_ID" ON "lessons" ("student_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_LESSONS_DATE_STATUS" ON "lessons" ("date", "status")`,
      `CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_STUDENT_ID" ON "payments" ("student_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_LESSON_ID" ON "payments" ("lesson_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_PAYMENT_COURSE_ID" ON "payments" ("course_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_COURSE_STUDENT_ID" ON "courses" ("student_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_LESSON_MATERIAL_COURSE_ID" ON "lesson_materials" ("course_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_SCHEDULE_SLOT_TEACHER_ID" ON "schedule_slots" ("teacher_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_LESSON_STUDENT_LESSON_ID" ON "lesson_students" ("lesson_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_LESSON_STUDENT_STUDENT_ID" ON "lesson_students" ("student_id")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_LESSON_BALANCE_STUDENT_ID" ON "lesson_balances" ("student_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_TEACHER_PAYMENT_TEACHER_ID" ON "teacher_payments" ("teacher_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_TEACHER_PAYMENT_LESSON_ID" ON "teacher_payments" ("lesson_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_MATERIAL_ACCESS_USER_ID" ON "material_access" ("user_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_MATERIAL_ACCESS_MATERIAL_ID" ON "material_access" ("material_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_TEACHER_AVAILABILITY_TEACHER_ID" ON "teacher_availability" ("teacher_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_ALFA_ORDER_STUDENT_ID" ON "alfa_bank_orders" ("student_id")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ALFA_ORDER_ORDER_NUMBER" ON "alfa_bank_orders" ("order_number")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ALFA_ORDER_ALFA_ORDER_ID" ON "alfa_bank_orders" ("alfa_order_id")`,
      `CREATE INDEX IF NOT EXISTS "IDX_APP_SETTINGS_KEY" ON "app_settings" ("key")`,
      `CREATE INDEX IF NOT EXISTS "IDX_SHOP_SETTINGS_KEY" ON "shop_settings" ("key")`,
      `CREATE INDEX IF NOT EXISTS "IDX_WELCOME_PAGE_SETTINGS_KEY" ON "welcome_page_settings" ("key")`,
    ];

    for (const sql of indexes) {
      await queryRunner.query(sql);
    }
  }

  private async createForeignKeys(queryRunner: QueryRunner): Promise<void> {
    const foreignKeys = [
      `ALTER TABLE "students" ADD CONSTRAINT "FK_students_assigned_teacher" FOREIGN KEY ("assigned_teacher") REFERENCES "teachers"("id") ON DELETE SET NULL NOT VALID`,
      `ALTER TABLE "students" ADD CONSTRAINT "FK_students_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL NOT VALID`,
      `ALTER TABLE "teachers" ADD CONSTRAINT "FK_teachers_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL NOT VALID`,
      `ALTER TABLE "lessons" ADD CONSTRAINT "FK_lessons_schedule_slot_id" FOREIGN KEY ("schedule_slot_id") REFERENCES "schedule_slots"("id") ON DELETE SET NULL NOT VALID`,
      `ALTER TABLE "lessons" ADD CONSTRAINT "FK_lessons_teacher_id" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT NOT VALID`,
      `ALTER TABLE "lessons" ADD CONSTRAINT "FK_lessons_student_id" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL NOT VALID`,
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_student_id" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT NOT VALID`,
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_lesson_id" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL NOT VALID`,
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_course_id" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL NOT VALID`,
      `ALTER TABLE "courses" ADD CONSTRAINT "FK_courses_student_id" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL NOT VALID`,
      `ALTER TABLE "lesson_materials" ADD CONSTRAINT "FK_lesson_materials_course_id" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT NOT VALID`,
      `ALTER TABLE "schedule_slots" ADD CONSTRAINT "FK_schedule_slots_teacher_id" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT NOT VALID`,
      `ALTER TABLE "lesson_students" ADD CONSTRAINT "FK_lesson_students_lesson_id" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE NOT VALID`,
      `ALTER TABLE "lesson_students" ADD CONSTRAINT "FK_lesson_students_student_id" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE NOT VALID`,
      `ALTER TABLE "lesson_balances" ADD CONSTRAINT "FK_lesson_balances_student_id" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE NOT VALID`,
      `ALTER TABLE "teacher_payments" ADD CONSTRAINT "FK_teacher_payments_teacher_id" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT NOT VALID`,
      `ALTER TABLE "teacher_payments" ADD CONSTRAINT "FK_teacher_payments_lesson_id" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL NOT VALID`,
      `ALTER TABLE "material_access" ADD CONSTRAINT "FK_material_access_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE NOT VALID`,
      `ALTER TABLE "material_access" ADD CONSTRAINT "FK_material_access_material_id" FOREIGN KEY ("material_id") REFERENCES "lesson_materials"("id") ON DELETE CASCADE NOT VALID`,
      `ALTER TABLE "teacher_availability" ADD CONSTRAINT "FK_teacher_availability_teacher_id" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE NOT VALID`,
      `ALTER TABLE "alfa_bank_orders" ADD CONSTRAINT "FK_alfa_bank_orders_student_id" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT NOT VALID`,
    ];

    for (const sql of foreignKeys) {
      await queryRunner.query(`
        DO $$ BEGIN
          ${sql};
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }
  }

  private async dropForeignKeys(queryRunner: QueryRunner): Promise<void> {
    const constraints = [
      'FK_alfa_bank_orders_student_id',
      'FK_teacher_availability_teacher_id',
      'FK_material_access_material_id',
      'FK_material_access_user_id',
      'FK_teacher_payments_lesson_id',
      'FK_teacher_payments_teacher_id',
      'FK_lesson_balances_student_id',
      'FK_lesson_students_student_id',
      'FK_lesson_students_lesson_id',
      'FK_schedule_slots_teacher_id',
      'FK_lesson_materials_course_id',
      'FK_courses_student_id',
      'FK_payments_course_id',
      'FK_payments_lesson_id',
      'FK_payments_student_id',
      'FK_lessons_student_id',
      'FK_lessons_teacher_id',
      'FK_lessons_schedule_slot_id',
      'FK_teachers_user_id',
      'FK_students_user_id',
      'FK_students_assigned_teacher',
    ];

    for (const constraint of constraints) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TABLE IF EXISTS "students" DROP CONSTRAINT IF EXISTS "${constraint}";
          ALTER TABLE IF EXISTS "teachers" DROP CONSTRAINT IF EXISTS "${constraint}";
          ALTER TABLE IF EXISTS "lessons" DROP CONSTRAINT IF EXISTS "${constraint}";
          ALTER TABLE IF EXISTS "payments" DROP CONSTRAINT IF EXISTS "${constraint}";
          ALTER TABLE IF EXISTS "courses" DROP CONSTRAINT IF EXISTS "${constraint}";
          ALTER TABLE IF EXISTS "lesson_materials" DROP CONSTRAINT IF EXISTS "${constraint}";
          ALTER TABLE IF EXISTS "schedule_slots" DROP CONSTRAINT IF EXISTS "${constraint}";
          ALTER TABLE IF EXISTS "lesson_students" DROP CONSTRAINT IF EXISTS "${constraint}";
          ALTER TABLE IF EXISTS "lesson_balances" DROP CONSTRAINT IF EXISTS "${constraint}";
          ALTER TABLE IF EXISTS "teacher_payments" DROP CONSTRAINT IF EXISTS "${constraint}";
          ALTER TABLE IF EXISTS "material_access" DROP CONSTRAINT IF EXISTS "${constraint}";
          ALTER TABLE IF EXISTS "teacher_availability" DROP CONSTRAINT IF EXISTS "${constraint}";
          ALTER TABLE IF EXISTS "alfa_bank_orders" DROP CONSTRAINT IF EXISTS "${constraint}";
        END $$;
      `);
    }
  }

  private async dropIndexes(queryRunner: QueryRunner): Promise<void> {
    const indexes = [
      'IDX_STUDENT_EMAIL',
      'IDX_STUDENT_ASSIGNED_TEACHER',
      'IDX_TEACHER_EMAIL',
      'IDX_LESSON_SCHEDULE_SLOT_ID',
      'IDX_LESSON_TEACHER_ID',
      'IDX_LESSON_PRIMARY_STUDENT_ID',
      'IDX_LESSONS_DATE_STATUS',
      'IDX_PAYMENT_STUDENT_ID',
      'IDX_PAYMENT_LESSON_ID',
      'IDX_PAYMENT_COURSE_ID',
      'IDX_COURSE_STUDENT_ID',
      'IDX_LESSON_MATERIAL_COURSE_ID',
      'IDX_SCHEDULE_SLOT_TEACHER_ID',
      'IDX_LESSON_STUDENT_LESSON_ID',
      'IDX_LESSON_STUDENT_STUDENT_ID',
      'IDX_LESSON_BALANCE_STUDENT_ID',
      'IDX_TEACHER_PAYMENT_TEACHER_ID',
      'IDX_TEACHER_PAYMENT_LESSON_ID',
      'IDX_MATERIAL_ACCESS_USER_ID',
      'IDX_MATERIAL_ACCESS_MATERIAL_ID',
      'IDX_TEACHER_AVAILABILITY_TEACHER_ID',
      'IDX_ALFA_ORDER_STUDENT_ID',
      'IDX_ALFA_ORDER_ORDER_NUMBER',
      'IDX_ALFA_ORDER_ALFA_ORDER_ID',
      'IDX_APP_SETTINGS_KEY',
      'IDX_SHOP_SETTINGS_KEY',
      'IDX_WELCOME_PAGE_SETTINGS_KEY',
    ];

    for (const index of indexes) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${index}"`);
    }
  }

  private async dropRelationalColumns(queryRunner: QueryRunner): Promise<void> {
    const tableColumns: Record<string, string[]> = {
      students: [
        'name', 'first_name', 'last_name', 'email', 'phone', 'telegram_id',
        'assigned_teacher', 'lesson_balance', 'start_date', 'birthday', 'notes', 'status', 'user_id',
      ],
      teachers: [
        'name', 'first_name', 'last_name', 'email', 'hourly_rate', 'telegram_id',
        'status', 'specializations', 'user_id',
      ],
      lessons: [
        'schedule_slot_id', 'teacher_id', 'teacher_name', 'teacher_first_name', 'teacher_last_name',
        'student_id', 'student_name', 'student_first_name', 'student_last_name', 'student_ids',
        'student_names', 'date', 'start_time', 'duration', 'meeting_link', 'status', 'lesson_format',
        'lesson_type', 'lesson_topic', 'notes', 'is_recurring', 'recurring_group_id', 'material_ids',
        'balance_deducted', 'teacher_payment_id', 'reminder_24h_sent', 'reminder_2h_sent',
      ],
      payments: [
        'student_id', 'lesson_id', 'course_id', 'amount', 'currency', 'status', 'provider',
        'external_id', 'paid_at', 'notes',
      ],
      courses: [
        'student_id', 'student_name', 'course_type', 'course_name', 'total_lessons',
        'completed_lessons', 'start_date', 'status', 'notes',
      ],
      lesson_materials: ['title', 'description', 'file_url', 'file_type', 'course_id', 'block_name', 'tags'],
      schedule_slots: [
        'teacher_id', 'date', 'start_time', 'duration', 'lesson_type', 'format', 'status',
        'recurring_group_id', 'meeting_link',
      ],
      lesson_students: ['lesson_id', 'student_id', 'attendance_status', 'balance_deducted'],
      lesson_balances: ['student_id', 'lessons_available', 'lessons_used'],
      teacher_payments: ['teacher_id', 'lesson_id', 'amount', 'status', 'note'],
      material_access: ['user_id', 'material_id', 'granted_by_role', 'access', 'notes'],
      teacher_availability: ['teacher_id', 'slots'],
      alfa_bank_orders: [
        'student_id', 'order_number', 'alfa_order_id', 'type', 'item_id', 'amount', 'status',
        'payment_date', 'notes',
      ],
      app_settings: ['key', 'value', 'description', 'type', 'is_active'],
      shop_settings: ['key', 'value', 'description', 'type', 'is_active'],
      welcome_page_settings: ['key', 'value', 'description', 'type', 'is_active'],
    };

    for (const [table, columns] of Object.entries(tableColumns)) {
      for (const column of columns) {
        await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${column}"`);
      }
    }
  }

  private async dropEnumTypes(queryRunner: QueryRunner): Promise<void> {
    const enums = [
      'alfa_bank_orders_status_enum',
      'alfa_bank_orders_type_enum',
      'material_access_granted_by_role_enum',
      'teacher_payments_status_enum',
      'lesson_students_attendance_status_enum',
      'schedule_slots_status_enum',
      'schedule_slots_format_enum',
      'schedule_slots_lesson_type_enum',
      'lesson_materials_file_type_enum',
      'courses_status_enum',
      'courses_course_type_enum',
      'payments_provider_enum',
      'payments_status_enum',
      'lessons_lesson_type_enum',
      'lessons_lesson_format_enum',
      'lessons_status_enum',
      'teachers_status_enum',
      'students_status_enum',
    ];

    for (const enumType of enums) {
      await queryRunner.query(`DROP TYPE IF EXISTS "${enumType}"`);
    }
  }
}
