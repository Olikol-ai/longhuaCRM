-- Assessment demo cleanup helpers.
-- Blueprint/template tables were removed (migration 174290).
-- Prefer cleaning via ExamBlock / Exam ownership in app admin UI.

SELECT 'assessment_exam_blocks' AS entity, count(*) FROM assessment_exam_blocks
UNION ALL
SELECT 'assessment_exams', count(*) FROM assessment_exams
UNION ALL
SELECT 'assessment_questions', count(*) FROM assessment_questions;
