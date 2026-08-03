import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Individual weekly recurrence (teacher/tutor schedule "Повторять каждую неделю").
 * Distinct from group course lesson_series (fixed total_lessons).
 */
export class LessonRecurrenceSeries1745700000000 implements MigrationInterface {
  name = 'LessonRecurrenceSeries1745700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lesson_recurrence_series (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        teacher_id uuid NULL REFERENCES teachers(id) ON DELETE SET NULL,
        tutor_id uuid NULL REFERENCES tutors(id) ON DELETE SET NULL,
        group_id uuid NULL REFERENCES groups(id) ON DELETE SET NULL,
        primary_student_id uuid NULL REFERENCES students(id) ON DELETE SET NULL,
        primary_tutor_student_id uuid NULL REFERENCES tutor_students(id) ON DELETE SET NULL,
        primary_teacher_student_contact_id uuid NULL
          REFERENCES teacher_student_contacts(id) ON DELETE SET NULL,
        weekday smallint NOT NULL,
        start_date date NOT NULL,
        start_time time NOT NULL,
        duration integer NOT NULL DEFAULT 60,
        lesson_type varchar(32) NOT NULL DEFAULT 'individual',
        lesson_format varchar(32) NOT NULL DEFAULT 'online',
        meeting_link text NULL,
        room varchar(128) NULL,
        notes text NULL,
        status varchar(32) NOT NULL DEFAULT 'active',
        until_date date NULL,
        created_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT CHK_LESSON_RECURRENCE_WEEKDAY CHECK (weekday >= 0 AND weekday <= 6),
        CONSTRAINT CHK_LESSON_RECURRENCE_STATUS CHECK (status IN ('active', 'stopped'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_LESSON_RECURRENCE_STATUS
        ON lesson_recurrence_series (status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_LESSON_RECURRENCE_TEACHER
        ON lesson_recurrence_series (teacher_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_LESSON_RECURRENCE_TUTOR
        ON lesson_recurrence_series (tutor_id)
    `);

    await queryRunner.query(`
      ALTER TABLE lessons
        ADD COLUMN IF NOT EXISTS recurrence_series_id uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE lessons
        ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_lessons_recurrence_series_id'
        ) THEN
          ALTER TABLE lessons
            ADD CONSTRAINT FK_lessons_recurrence_series_id
            FOREIGN KEY (recurrence_series_id)
            REFERENCES lesson_recurrence_series(id)
            ON DELETE SET NULL;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_LESSON_RECURRENCE_SERIES_ID
        ON lessons (recurrence_series_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE lessons DROP CONSTRAINT IF EXISTS FK_lessons_recurrence_series_id
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_LESSON_RECURRENCE_SERIES_ID`);
    await queryRunner.query(`ALTER TABLE lessons DROP COLUMN IF EXISTS is_recurring`);
    await queryRunner.query(`ALTER TABLE lessons DROP COLUMN IF EXISTS recurrence_series_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS lesson_recurrence_series`);
  }
}
