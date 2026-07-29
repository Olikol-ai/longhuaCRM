import { MigrationInterface, QueryRunner } from 'typeorm';

export class LessonStudentChangeHistory1743200000000 implements MigrationInterface {
  name = 'LessonStudentChangeHistory1743200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lesson_student_change_history (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        actor_user_id uuid NULL,
        actor_role varchar(32) NOT NULL,
        old_target_type varchar(32) NULL,
        old_target_id uuid NULL,
        old_display_name text NULL,
        new_target_type varchar(32) NOT NULL,
        new_target_id uuid NOT NULL,
        new_display_name text NOT NULL,
        balance_restored boolean NOT NULL DEFAULT false,
        balance_deducted boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_LESSON_STUDENT_CHANGE_HISTORY_LESSON
      ON lesson_student_change_history (lesson_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_LESSON_STUDENT_CHANGE_HISTORY_CREATED
      ON lesson_student_change_history (created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS lesson_student_change_history`);
  }
}
