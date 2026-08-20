import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-occurrence exceptions for rolling weekly recurrence.
 * When one Tuesday is moved/cancelled/deleted, cron must never recreate that Tuesday.
 */
export class LessonRecurrenceExceptions1746200000000 implements MigrationInterface {
  name = 'LessonRecurrenceExceptions1746200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lesson_recurrence_exceptions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        recurrence_series_id uuid NOT NULL
          REFERENCES lesson_recurrence_series(id) ON DELETE CASCADE,
        original_date date NOT NULL,
        reason varchar(32) NOT NULL,
        lesson_id uuid NULL REFERENCES lessons(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT CHK_LESSON_RECURRENCE_EXCEPTION_REASON
          CHECK (reason IN ('rescheduled', 'cancelled', 'deleted', 'detached'))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_LESSON_RECURRENCE_EXCEPTION_SERIES_DATE
        ON lesson_recurrence_exceptions (recurrence_series_id, original_date)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_LESSON_RECURRENCE_EXCEPTION_SERIES
        ON lesson_recurrence_exceptions (recurrence_series_id)
    `);

    // Backfill: cancelled/rescheduled rows still linked to a series already "own" that date.
    await queryRunner.query(`
      INSERT INTO lesson_recurrence_exceptions (
        id, recurrence_series_id, original_date, reason, lesson_id
      )
      SELECT
        uuid_generate_v4(),
        l.recurrence_series_id,
        l.date,
        CASE
          WHEN l.status = 'cancelled' THEN 'cancelled'
          WHEN l.status = 'rescheduled' THEN 'rescheduled'
          ELSE 'cancelled'
        END,
        l.id
      FROM lessons l
      WHERE l.recurrence_series_id IS NOT NULL
        AND l.status IN ('cancelled', 'rescheduled')
      ON CONFLICT (recurrence_series_id, original_date) DO NOTHING
    `);

    // Backfill: planned lessons moved off the series weekday (classic "перенос одного").
    // Mark the series weekday in that ISO week as skipped so cron never recreates it.
    await queryRunner.query(`
      INSERT INTO lesson_recurrence_exceptions (
        id, recurrence_series_id, original_date, reason, lesson_id
      )
      SELECT
        uuid_generate_v4(),
        l.recurrence_series_id,
        (
          l.date::date
          - (((EXTRACT(ISODOW FROM l.date::date)::int - 1) - s.weekday + 7) % 7)
        )::date AS original_date,
        'rescheduled',
        l.id
      FROM lessons l
      JOIN lesson_recurrence_series s ON s.id = l.recurrence_series_id
      WHERE l.recurrence_series_id IS NOT NULL
        AND l.status = 'planned'
        AND (
          CASE EXTRACT(ISODOW FROM l.date::date)::int
            WHEN 1 THEN 0 WHEN 2 THEN 1 WHEN 3 THEN 2 WHEN 4 THEN 3
            WHEN 5 THEN 4 WHEN 6 THEN 5 WHEN 7 THEN 6
          END
        ) <> s.weekday
      ON CONFLICT (recurrence_series_id, original_date) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_LESSON_RECURRENCE_EXCEPTION_SERIES`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS UQ_LESSON_RECURRENCE_EXCEPTION_SERIES_DATE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS lesson_recurrence_exceptions`);
  }
}
