import { MigrationInterface, QueryRunner } from 'typeorm';

export class EliminateJsonbAndArrays1730000000010 implements MigrationInterface {
  name = 'EliminateJsonbAndArrays1730000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "teacher_availability_slots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teacher_id" uuid NOT NULL,
        "day_of_week" smallint NOT NULL,
        "time_from" time NOT NULL,
        "time_to" time NOT NULL,
        "created_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teacher_availability_slots" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_material_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "lesson_id" uuid NOT NULL,
        "material_id" uuid NOT NULL,
        "created_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_material_links" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lesson_material_tags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "material_id" uuid NOT NULL,
        "tag" character varying(128) NOT NULL,
        "created_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lesson_material_tags" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_TA_SLOT_TEACHER_ID"
      ON "teacher_availability_slots" ("teacher_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_LESSON_MATERIAL_LINK_LESSON_ID"
      ON "lesson_material_links" ("lesson_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_LESSON_MATERIAL_LINK_MATERIAL_ID"
      ON "lesson_material_links" ("material_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_LESSON_MATERIAL_LINK_UNIQUE"
      ON "lesson_material_links" ("lesson_id", "material_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_LESSON_MATERIAL_TAG_MATERIAL_ID"
      ON "lesson_material_tags" ("material_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_LESSON_MATERIAL_TAG_UNIQUE"
      ON "lesson_material_tags" ("material_id", "tag")
    `);

    await queryRunner.query(`
      ALTER TABLE "teacher_availability_slots"
        ADD CONSTRAINT "FK_ta_slots_teacher_id"
        FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE NOT VALID
    `);
    await queryRunner.query(`
      ALTER TABLE "lesson_material_links"
        ADD CONSTRAINT "FK_lml_lesson_id"
        FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE NOT VALID
    `);
    await queryRunner.query(`
      ALTER TABLE "lesson_material_links"
        ADD CONSTRAINT "FK_lml_material_id"
        FOREIGN KEY ("material_id") REFERENCES "lesson_materials"("id") ON DELETE CASCADE NOT VALID
    `);
    await queryRunner.query(`
      ALTER TABLE "lesson_material_tags"
        ADD CONSTRAINT "FK_lmt_material_id"
        FOREIGN KEY ("material_id") REFERENCES "lesson_materials"("id") ON DELETE CASCADE NOT VALID
    `);

    await queryRunner.query(`
      INSERT INTO "teacher_availability_slots" (
        "id", "teacher_id", "day_of_week", "time_from", "time_to", "created_date", "updated_date"
      )
      SELECT
        uuid_generate_v4(),
        ta."teacher_id",
        (elem->>'day')::smallint,
        (elem->>'from')::time,
        (elem->>'to')::time,
        ta."created_date",
        ta."updated_date"
      FROM "teacher_availability" ta
      CROSS JOIN LATERAL jsonb_array_elements(ta."slots") AS elem
      WHERE ta."slots" IS NOT NULL
        AND jsonb_typeof(ta."slots") = 'array'
        AND jsonb_array_length(ta."slots") > 0
    `);

    await queryRunner.query(`
      INSERT INTO "lesson_students" (
        "id", "lesson_id", "student_id", "attendance_status", "balance_deducted", "created_date", "updated_date"
      )
      SELECT
        uuid_generate_v4(),
        l."id",
        trim(sid)::uuid,
        'enrolled',
        false,
        COALESCE(l."created_date", now()),
        COALESCE(l."updated_date", now())
      FROM "lessons" l
      CROSS JOIN LATERAL unnest(string_to_array(l."student_ids", ',')) AS sid
      WHERE l."student_ids" IS NOT NULL
        AND trim(l."student_ids") <> ''
        AND trim(sid) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM "lesson_students" ls
          WHERE ls."lesson_id" = l."id" AND ls."student_id" = trim(sid)::uuid
        )
    `);

    await queryRunner.query(`
      INSERT INTO "lesson_material_links" (
        "id", "lesson_id", "material_id", "created_date", "updated_date"
      )
      SELECT
        uuid_generate_v4(),
        l."id",
        trim(mid)::uuid,
        COALESCE(l."created_date", now()),
        COALESCE(l."updated_date", now())
      FROM "lessons" l
      CROSS JOIN LATERAL unnest(string_to_array(l."material_ids", ',')) AS mid
      WHERE l."material_ids" IS NOT NULL
        AND trim(l."material_ids") <> ''
        AND trim(mid) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM "lesson_material_links" lml
          WHERE lml."lesson_id" = l."id" AND lml."material_id" = trim(mid)::uuid
        )
    `);

    await queryRunner.query(`
      INSERT INTO "lesson_material_tags" ("id", "material_id", "tag", "created_date")
      SELECT
        uuid_generate_v4(),
        lm."id",
        trim(tag),
        COALESCE(lm."created_date", now())
      FROM "lesson_materials" lm
      CROSS JOIN LATERAL unnest(string_to_array(lm."tags", ',')) AS tag
      WHERE lm."tags" IS NOT NULL
        AND trim(lm."tags") <> ''
        AND trim(tag) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM "lesson_material_tags" lmt
          WHERE lmt."material_id" = lm."id" AND lmt."tag" = trim(tag)
        )
    `);

    await queryRunner.query(`ALTER TABLE "teacher_availability" DROP COLUMN IF EXISTS "slots"`);
    await queryRunner.query(`ALTER TABLE "lessons" DROP COLUMN IF EXISTS "student_ids"`);
    await queryRunner.query(`ALTER TABLE "lessons" DROP COLUMN IF EXISTS "student_names"`);
    await queryRunner.query(`ALTER TABLE "lessons" DROP COLUMN IF EXISTS "material_ids"`);
    await queryRunner.query(`ALTER TABLE "lesson_materials" DROP COLUMN IF EXISTS "tags"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lesson_materials" ADD COLUMN IF NOT EXISTS "tags" text
    `);
    await queryRunner.query(`
      ALTER TABLE "lessons"
        ADD COLUMN IF NOT EXISTS "material_ids" text,
        ADD COLUMN IF NOT EXISTS "student_names" text,
        ADD COLUMN IF NOT EXISTS "student_ids" text
    `);
    await queryRunner.query(`
      ALTER TABLE "teacher_availability" ADD COLUMN IF NOT EXISTS "slots" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "lesson_material_tags" DROP CONSTRAINT IF EXISTS "FK_lmt_material_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "lesson_material_links" DROP CONSTRAINT IF EXISTS "FK_lml_material_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "lesson_material_links" DROP CONSTRAINT IF EXISTS "FK_lml_lesson_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "teacher_availability_slots" DROP CONSTRAINT IF EXISTS "FK_ta_slots_teacher_id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_material_tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lesson_material_links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teacher_availability_slots"`);
  }
}
