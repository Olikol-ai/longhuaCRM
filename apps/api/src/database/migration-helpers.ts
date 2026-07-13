import { QueryRunner } from 'typeorm';

export async function createIndexIfColumnsExist(
  queryRunner: QueryRunner,
  indexName: string,
  table: string,
  columns: string[],
  whereClause?: string,
): Promise<void> {
  const columnChecks = columns
    .map(
      (column) =>
        `EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}')`,
    )
    .join(' AND ');
  const columnList = columns.map((column) => `"${column}"`).join(', ');
  const whereSql = whereClause ? ` WHERE ${whereClause}` : '';

  await queryRunner.query(`
    DO $$
    BEGIN
      IF ${columnChecks} THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS "${indexName}" ON "${table}" (${columnList})${whereSql.replace(/'/g, "''")}';
      END IF;
    END $$;
  `);
}

export async function alignLegacyTablesForV2(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'assigned_teacher'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'assigned_teacher_id'
      ) THEN
        ALTER TABLE "students" ADD COLUMN "assigned_teacher_id" uuid;
        UPDATE "students" SET "assigned_teacher_id" = "assigned_teacher"
        WHERE "assigned_teacher_id" IS NULL AND "assigned_teacher" IS NOT NULL;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'created_date'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'created_at'
      ) THEN
        ALTER TABLE "students" ADD COLUMN "created_at" timestamptz;
        UPDATE "students" SET "created_at" = "created_date"
        WHERE "created_at" IS NULL AND "created_date" IS NOT NULL;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'updated_date'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'updated_at'
      ) THEN
        ALTER TABLE "students" ADD COLUMN "updated_at" timestamptz;
        UPDATE "students" SET "updated_at" = "updated_date"
        WHERE "updated_at" IS NULL AND "updated_date" IS NOT NULL;
      END IF;
    END $$;
  `);

  await queryRunner.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'lessons'
      ) THEN
        ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "series_id" uuid;
        ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "group_id" uuid;
        ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "primary_student_id" uuid;
        ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "created_at" timestamptz;
        ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'recurrence_series_id'
        ) THEN
          UPDATE "lessons" SET "series_id" = "recurrence_series_id"
          WHERE "series_id" IS NULL AND "recurrence_series_id" IS NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'recurring_group_id'
        ) THEN
          UPDATE "lessons" SET "group_id" = "recurring_group_id"
          WHERE "group_id" IS NULL AND "recurring_group_id" IS NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'student_id'
        ) THEN
          UPDATE "lessons" SET "primary_student_id" = "student_id"
          WHERE "primary_student_id" IS NULL AND "student_id" IS NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'created_date'
        ) THEN
          UPDATE "lessons" SET "created_at" = "created_date"
          WHERE "created_at" IS NULL AND "created_date" IS NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'updated_date'
        ) THEN
          UPDATE "lessons" SET "updated_at" = "updated_date"
          WHERE "updated_at" IS NULL AND "updated_date" IS NOT NULL;
        END IF;
      END IF;
    END $$;
  `);

  await queryRunner.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'payments'
      ) THEN
        ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "shop_item_id" uuid;
        ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "enrollment_id" uuid;
        ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "created_at" timestamptz;
        ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'created_date'
        ) THEN
          UPDATE "payments" SET "created_at" = "created_date"
          WHERE "created_at" IS NULL AND "created_date" IS NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'updated_date'
        ) THEN
          UPDATE "payments" SET "updated_at" = "updated_date"
          WHERE "updated_at" IS NULL AND "updated_date" IS NOT NULL;
        END IF;
      END IF;
    END $$;
  `);

  await queryRunner.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'assigned_teacher_id'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'teachers'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'FK_students_assigned_teacher_id'
      ) THEN
        BEGIN
          ALTER TABLE "students"
          ADD CONSTRAINT "FK_students_assigned_teacher_id"
          FOREIGN KEY ("assigned_teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN
          NULL;
        END;
      END IF;
    END $$;
  `);
}

/**
 * Rebinds a teachers FK from RESTRICT/NOT NULL to ON DELETE SET NULL.
 * Used when deleting a teacher must preserve CRM history (lessons, groups, payments).
 */
export async function rebindTeacherFkToSetNull(
  queryRunner: QueryRunner,
  table: string,
  column: string,
  constraintName: string,
): Promise<void> {
  await queryRunner.query(`
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '${table}'
      ) THEN
        FOR r IN
          SELECT tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = 'public'
            AND tc.table_name = '${table}'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = '${column}'
        LOOP
          EXECUTE format('ALTER TABLE "${table}" DROP CONSTRAINT %I', r.constraint_name);
        END LOOP;
      END IF;
    END $$;
  `);

  await queryRunner.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'
      ) THEN
        ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP NOT NULL;
      END IF;
    END $$;
  `);

  await queryRunner.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'teachers'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'public' AND constraint_name = '${constraintName}'
      ) THEN
        ALTER TABLE "${table}"
        ADD CONSTRAINT "${constraintName}"
        FOREIGN KEY ("${column}") REFERENCES "teachers"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `);
}

export async function alignLegacyForeignKeysForV2(queryRunner: QueryRunner): Promise<void> {
  const fkDefs: Array<{ name: string; table: string; column: string; refTable: string; onDelete: string }> = [
    { name: 'FK_lessons_series_id', table: 'lessons', column: 'series_id', refTable: 'lesson_series', onDelete: 'SET NULL' },
    { name: 'FK_lessons_group_id', table: 'lessons', column: 'group_id', refTable: 'groups', onDelete: 'SET NULL' },
    { name: 'FK_lessons_primary_student_id', table: 'lessons', column: 'primary_student_id', refTable: 'students', onDelete: 'SET NULL' },
    { name: 'FK_payments_shop_item_id', table: 'payments', column: 'shop_item_id', refTable: 'shop_items', onDelete: 'SET NULL' },
    { name: 'FK_payments_enrollment_id', table: 'payments', column: 'enrollment_id', refTable: 'enrollments', onDelete: 'SET NULL' },
  ];

  for (const fk of fkDefs) {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${fk.table}' AND column_name = '${fk.column}'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = '${fk.refTable}'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = '${fk.name}'
        ) THEN
          BEGIN
            ALTER TABLE "${fk.table}"
            ADD CONSTRAINT "${fk.name}"
            FOREIGN KEY ("${fk.column}") REFERENCES "${fk.refTable}"("id") ON DELETE ${fk.onDelete};
          EXCEPTION WHEN duplicate_object THEN
            NULL;
          END;
        END IF;
      END $$;
    `);
  }
}
