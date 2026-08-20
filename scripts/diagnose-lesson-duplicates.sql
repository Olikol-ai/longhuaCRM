/**
 * Diagnostic helper: find suspicious schedule duplicates.
 * Same date + time + teacher + student across multiple lesson rows.
 *
 * Run:
 *   DATABASE_URL=... psql "$DATABASE_URL" -f scripts/diagnose-lesson-duplicates.sql
 */
SELECT
  l.date,
  l.start_time,
  l.teacher_id,
  l.primary_student_id,
  count(*) AS cnt,
  array_agg(l.id::text ORDER BY l.created_at) AS lesson_ids,
  array_agg(l.status ORDER BY l.created_at) AS statuses,
  array_agg(COALESCE(l.recurrence_series_id::text, '-') ORDER BY l.created_at) AS series_ids
FROM lessons l
WHERE l.teacher_id IS NOT NULL
  AND l.primary_student_id IS NOT NULL
GROUP BY l.date, l.start_time, l.teacher_id, l.primary_student_id
HAVING count(*) > 1
ORDER BY cnt DESC, l.date DESC;

-- Recurrence: multiple planned rows on the same series date (regen bug signature)
SELECT
  recurrence_series_id,
  date,
  count(*) AS planned_cnt,
  array_agg(id::text ORDER BY created_at) AS lesson_ids
FROM lessons
WHERE recurrence_series_id IS NOT NULL
  AND status = 'planned'
GROUP BY recurrence_series_id, date
HAVING count(*) > 1
ORDER BY planned_cnt DESC, date DESC;

-- Exception dates that still have a planned occurrence (should be 0)
SELECT
  e.recurrence_series_id,
  e.original_date,
  e.reason,
  count(l.id) AS planned_on_date
FROM lesson_recurrence_exceptions e
LEFT JOIN lessons l
  ON l.recurrence_series_id = e.recurrence_series_id
 AND l.date = e.original_date
 AND l.status = 'planned'
GROUP BY e.recurrence_series_id, e.original_date, e.reason
HAVING count(l.id) > 0
ORDER BY e.original_date DESC;

-- Historical note: completed/cancelled rows MAY remain on exception dates.
-- Typical cause (pre-exception era): fillHorizon regenerated the weekday after
-- a reschedule; auto-complete then marked that ghost as completed.
-- That completed row is a financial/history artifact — do NOT delete blindly.
-- Exception correctly blocks NEW planned recreations.
SELECT
  e.recurrence_series_id,
  e.original_date,
  e.reason,
  e.lesson_id AS moved_or_source_lesson_id,
  l.id AS leftover_id,
  l.status AS leftover_status,
  l.created_at AS leftover_created_at
FROM lesson_recurrence_exceptions e
JOIN lessons l
  ON l.recurrence_series_id = e.recurrence_series_id
 AND l.date = e.original_date
WHERE l.status <> 'planned'
ORDER BY e.original_date DESC;
