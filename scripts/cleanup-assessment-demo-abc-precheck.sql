-- Pre-delete verification for Assessment A+B+C cleanup

SELECT 'PRE_COUNTS' AS section;
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
) x ORDER BY o;

SELECT 'TARGET_BANKS' AS section;
SELECT id, name, status FROM assessment_banks
WHERE id IN (
  'e8f29688-cbb6-4ee6-8bb2-0b9ff6c4ba63',
  '073b71b7-71a1-4522-8d00-5d00844021fd',
  '0575d22b-8adc-4da7-a3ef-5160442be568'
)
ORDER BY created_at;

SELECT 'TARGET_TEMPLATES' AS section;
SELECT id, name, status FROM assessment_exam_templates
WHERE id IN (
  'cd30c8e3-32a7-4d7b-8a8b-15ad31f09902',
  '893f9087-b218-4f6a-8163-f662d28c197c',
  'c334acb8-53ba-4bf7-8ad8-77f6179b0f1c'
)
ORDER BY created_at;

SELECT 'TARGET_BLUEPRINTS' AS section;
SELECT id, name, status FROM assessment_blueprints
WHERE id IN (
  '8c04bec0-ccb9-4a47-9c8c-816bf1deb657',
  '4b4e8a29-4cbb-44e2-9bfb-6d63512d27b7',
  '56bb32e5-a379-484d-a186-3f50c3334225'
)
ORDER BY created_at;

SELECT 'TARGET_EXAMS' AS section;
SELECT id, name, status FROM assessment_exams
WHERE id IN (
  '50035e54-2507-44ab-abdc-0cd8c9825bab',
  '20bbe0da-b546-4e8d-a4ec-9f81eadfb5bf',
  '93a21d99-32f2-4a73-9219-626723d7fc82',
  'f16cadf0-bfbe-4fbe-8869-e7d0715b6fe7'
)
ORDER BY created_at;

SELECT 'NON_TARGET_CHECK' AS section;
SELECT 'banks_outside' AS kind, count(*)::int AS c FROM assessment_banks
WHERE id NOT IN (
  'e8f29688-cbb6-4ee6-8bb2-0b9ff6c4ba63',
  '073b71b7-71a1-4522-8d00-5d00844021fd',
  '0575d22b-8adc-4da7-a3ef-5160442be568'
)
UNION ALL
SELECT 'exams_outside', count(*) FROM assessment_exams
WHERE id NOT IN (
  '50035e54-2507-44ab-abdc-0cd8c9825bab',
  '20bbe0da-b546-4e8d-a4ec-9f81eadfb5bf',
  '93a21d99-32f2-4a73-9219-626723d7fc82',
  'f16cadf0-bfbe-4fbe-8869-e7d0715b6fe7'
)
UNION ALL
SELECT 'blueprints_outside', count(*) FROM assessment_blueprints
WHERE id NOT IN (
  '8c04bec0-ccb9-4a47-9c8c-816bf1deb657',
  '4b4e8a29-4cbb-44e2-9bfb-6d63512d27b7',
  '56bb32e5-a379-484d-a186-3f50c3334225'
)
UNION ALL
SELECT 'templates_outside', count(*) FROM assessment_exam_templates
WHERE id NOT IN (
  'cd30c8e3-32a7-4d7b-8a8b-15ad31f09902',
  '893f9087-b218-4f6a-8163-f662d28c197c',
  'c334acb8-53ba-4bf7-8ad8-77f6179b0f1c'
)
UNION ALL
SELECT 'questions_outside_banks', count(*) FROM assessment_questions
WHERE bank_id NOT IN (
  'e8f29688-cbb6-4ee6-8bb2-0b9ff6c4ba63',
  '073b71b7-71a1-4522-8d00-5d00844021fd',
  '0575d22b-8adc-4da7-a3ef-5160442be568'
);

SELECT 'NON_ASSESSMENT_PRESERVE' AS section;
SELECT 'users' AS t, count(*)::int AS c FROM users
UNION ALL SELECT 'students', count(*) FROM students
UNION ALL SELECT 'teachers', count(*) FROM teachers
UNION ALL SELECT 'course_templates', count(*) FROM course_templates
UNION ALL SELECT 'enrollments', count(*) FROM enrollments
UNION ALL SELECT 'lessons', count(*) FROM lessons
UNION ALL SELECT 'certificates', count(*) FROM certificates;
