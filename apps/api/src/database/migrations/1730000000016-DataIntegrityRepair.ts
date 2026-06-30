import { MigrationInterface, QueryRunner } from 'typeorm';

export class DataIntegrityRepair1730000000016 implements MigrationInterface {
  name = 'DataIntegrityRepair1730000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Materials in wrong course folder → detach folder link.
    await queryRunner.query(`
      UPDATE "lesson_materials" m
      SET "folder_id" = NULL, "updated_date" = NOW()
      FROM "course_folders" f
      WHERE m."folder_id" = f."id"
        AND m."course_id" <> f."course_id"
    `);

    // Orphan folder references (parent deleted) → root level.
    await queryRunner.query(`
      UPDATE "course_folders" child
      SET "parent_folder_id" = NULL, "updated_date" = NOW()
      WHERE child."parent_folder_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "course_folders" parent
          WHERE parent."id" = child."parent_folder_id"
        )
    `);

    // Cross-course parent links → detach parent.
    await queryRunner.query(`
      UPDATE "course_folders" child
      SET "parent_folder_id" = NULL, "updated_date" = NOW()
      FROM "course_folders" parent
      WHERE child."parent_folder_id" = parent."id"
        AND child."course_id" <> parent."course_id"
    `);

    // Folders without valid course → remove (materials already detached above).
    await queryRunner.query(`
      DELETE FROM "course_folders" f
      WHERE NOT EXISTS (
        SELECT 1 FROM "courses" c WHERE c."id" = f."course_id"
      )
    `);

    // Re-link student profiles for active student-role users missing user_id link.
    await queryRunner.query(`
      UPDATE "students" s
      SET
        "user_id" = u."id",
        "status" = 'active',
        "updated_date" = NOW()
      FROM "users" u
      WHERE u."role" = 'student'
        AND LOWER(s."email") = LOWER(u."email")
        AND (s."user_id" IS NULL OR s."user_id" = u."id")
        AND NOT EXISTS (
          SELECT 1 FROM "students" s2
          WHERE s2."user_id" = u."id" AND s2."id" <> s."id"
        )
    `);

    // Re-link teacher profiles for active teacher-role users missing user_id link.
    await queryRunner.query(`
      UPDATE "teachers" t
      SET
        "user_id" = u."id",
        "status" = 'active',
        "updated_date" = NOW()
      FROM "users" u
      WHERE u."role" = 'teacher'
        AND LOWER(t."email") = LOWER(u."email")
        AND (t."user_id" IS NULL OR t."user_id" = u."id")
        AND NOT EXISTS (
          SELECT 1 FROM "teachers" t2
          WHERE t2."user_id" = u."id" AND t2."id" <> t."id"
        )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive repair migration — no automatic rollback.
  }
}
