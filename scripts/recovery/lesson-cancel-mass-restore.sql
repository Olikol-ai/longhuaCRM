-- =============================================================================
-- RECOVERY SCRIPT (DO NOT RUN AUTOMATICALLY)
-- Prepared for: accidental mass / multi-lesson cancel incident review
-- Timezone reference: Europe/Minsk
-- =============================================================================
--
-- SAFETY:
-- 1. Take a backup / snapshot before any UPDATE.
-- 2. Review SELECT results with an operator.
-- 3. Run UPDATEs only after explicit human confirmation.
-- 4. Prefer restoring by concrete lesson id list, never by date alone.
--
-- =============================================================================

-- A) Inspect today's cancelled lessons (Europe/Minsk calendar date)
SELECT
  l.id,
  l.date,
  l.start_time,
  l.status,
  l.teacher_id,
  l.group_id,
  l.recurrence_series_id,
  l.updated_at
FROM lessons l
WHERE l.date = (NOW() AT TIME ZONE 'Europe/Minsk')::date
  AND l.status = 'cancelled'
ORDER BY l.updated_at, l.start_time;

-- B) Cluster cancels by update minute (detect single-batch mass updates)
SELECT
  date_trunc('minute', l.updated_at) AS minute_utc,
  COUNT(*)::int AS cnt
FROM lessons l
WHERE l.status = 'cancelled'
  AND l.updated_at >= NOW() - INTERVAL '2 days'
GROUP BY 1
HAVING COUNT(*) >= 3
ORDER BY cnt DESC, minute_utc DESC;

-- C) Exceptions marked cancelled vs current lesson status (inconsistency check)
SELECT
  e.id AS exception_id,
  e.recurrence_series_id,
  e.original_date,
  e.reason,
  e.lesson_id,
  e.created_at AS exception_at,
  l.status AS lesson_status,
  l.date AS lesson_date,
  l.updated_at AS lesson_updated
FROM lesson_recurrence_exceptions e
LEFT JOIN lessons l ON l.id = e.lesson_id
WHERE e.reason = 'cancelled'
  AND e.created_at >= NOW() - INTERVAL '2 days'
ORDER BY e.created_at;

-- D) EXAMPLE restore (REPLACE ids) — restores ONLY listed lesson ids to planned
-- BEGIN;
-- UPDATE lessons
-- SET status = 'planned',
--     updated_at = NOW()
-- WHERE id IN (
--   '00000000-0000-0000-0000-000000000001'
-- )
--   AND status = 'cancelled';
-- -- Optionally remove matching cancel exceptions for those dates:
-- -- DELETE FROM lesson_recurrence_exceptions
-- -- WHERE reason = 'cancelled'
-- --   AND lesson_id IN ('00000000-0000-0000-0000-000000000001');
-- COMMIT;
