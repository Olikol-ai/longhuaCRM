-- Post-cleanup integrity checks

SELECT 'POST_COUNTS' AS section;
SELECT * FROM (
  SELECT 1 AS o, 'assessment_banks' AS t, count(*)::int AS c FROM assessment_banks
  UNION ALL SELECT 2, 'assessment_questions', count(*) FROM assessment_questions
  UNION ALL SELECT 3, 'assessment_answers', count(*) FROM assessment_answers
  UNION ALL SELECT 4, 'assessment_exam_templates', count(*) FROM assessment_exam_templates
  UNION ALL SELECT 5, 'assessment_blueprints', count(*) FROM assessment_blueprints
  UNION ALL SELECT 6, 'assessment_blueprint_section_rules', count(*) FROM assessment_blueprint_section_rules
  UNION ALL SELECT 7, 'assessment_exams', count(*) FROM assessment_exams
  UNION ALL SELECT 8, 'assessment_sections', count(*) FROM assessment_sections
  UNION ALL SELECT 9, 'assessment_exam_questions', count(*) FROM assessment_exam_questions
  UNION ALL SELECT 10, 'assessment_rules', count(*) FROM assessment_rules
  UNION ALL SELECT 11, 'assessment_exam_assignments', count(*) FROM assessment_exam_assignments
  UNION ALL SELECT 12, 'assessment_attempts', count(*) FROM assessment_attempts
  UNION ALL SELECT 13, 'assessment_results', count(*) FROM assessment_results
  UNION ALL SELECT 14, 'assessment_result_breakdowns', count(*) FROM assessment_result_breakdowns
  UNION ALL SELECT 15, 'assessment_question_snapshots', count(*) FROM assessment_question_snapshots
  UNION ALL SELECT 16, 'assessment_answer_snapshots', count(*) FROM assessment_answer_snapshots
  UNION ALL SELECT 17, 'assessment_attempt_answers', count(*) FROM assessment_attempt_answers
  UNION ALL SELECT 18, 'assessment_attempt_answer_selections', count(*) FROM assessment_attempt_answer_selections
  UNION ALL SELECT 19, 'assessment_question_attachments', count(*) FROM assessment_question_attachments
  UNION ALL SELECT 20, 'assessment_question_topics', count(*) FROM assessment_question_topics
  UNION ALL SELECT 21, 'assessment_topics', count(*) FROM assessment_topics
) x ORDER BY o;

SELECT 'ORPHAN_CHECKS' AS section;
SELECT 'answers_without_question' AS check_name, count(*)::int AS c
FROM assessment_answers a
LEFT JOIN assessment_questions q ON q.id = a.question_id
WHERE q.id IS NULL
UNION ALL
SELECT 'exam_questions_without_exam', count(*)
FROM assessment_exam_questions eq
LEFT JOIN assessment_exams e ON e.id = eq.exam_id
WHERE e.id IS NULL
UNION ALL
SELECT 'exam_questions_without_question', count(*)
FROM assessment_exam_questions eq
LEFT JOIN assessment_questions q ON q.id = eq.question_id
WHERE q.id IS NULL
UNION ALL
SELECT 'blueprints_without_bank', count(*)
FROM assessment_blueprints b
LEFT JOIN assessment_banks bk ON bk.id = b.bank_id
WHERE bk.id IS NULL
UNION ALL
SELECT 'blueprints_without_template', count(*)
FROM assessment_blueprints b
LEFT JOIN assessment_exam_templates t ON t.id = b.exam_template_id
WHERE t.id IS NULL
UNION ALL
SELECT 'exams_without_blueprint', count(*)
FROM assessment_exams e
LEFT JOIN assessment_blueprints b ON b.id = e.blueprint_id
WHERE b.id IS NULL
UNION ALL
SELECT 'attempts_without_exam', count(*)
FROM assessment_attempts a
LEFT JOIN assessment_exams e ON e.id = a.exam_id
WHERE e.id IS NULL
UNION ALL
SELECT 'results_without_attempt', count(*)
FROM assessment_results r
LEFT JOIN assessment_attempts a ON a.id = r.attempt_id
WHERE a.id IS NULL
UNION ALL
SELECT 'results_without_exam', count(*)
FROM assessment_results r
LEFT JOIN assessment_exams e ON e.id = r.exam_id
WHERE e.id IS NULL
UNION ALL
SELECT 'snapshots_without_attempt', count(*)
FROM assessment_question_snapshots qs
LEFT JOIN assessment_attempts a ON a.id = qs.attempt_id
WHERE a.id IS NULL
UNION ALL
SELECT 'assignments_without_exam', count(*)
FROM assessment_exam_assignments a
LEFT JOIN assessment_exams e ON e.id = a.exam_id
WHERE e.id IS NULL
UNION ALL
SELECT 'certificates_dangling_assessment_result', count(*)
FROM certificates c
WHERE c.assessment_result_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM assessment_results r WHERE r.id = c.assessment_result_id);

SELECT 'PRESERVED_NON_ASSESSMENT' AS section;
SELECT 'users' AS t, count(*)::int AS c FROM users
UNION ALL SELECT 'students', count(*) FROM students
UNION ALL SELECT 'teachers', count(*) FROM teachers
UNION ALL SELECT 'course_templates', count(*) FROM course_templates
UNION ALL SELECT 'lessons', count(*) FROM lessons
UNION ALL SELECT 'certificates', count(*) FROM certificates;
