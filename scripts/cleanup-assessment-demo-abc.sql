-- Assessment demo/test cleanup A+B+C (one-shot)
-- Target IDs locked from audit 2026-07-21

BEGIN;

-- Target sets
CREATE TEMP TABLE _clean_banks (id uuid PRIMARY KEY);
CREATE TEMP TABLE _clean_templates (id uuid PRIMARY KEY);
CREATE TEMP TABLE _clean_blueprints (id uuid PRIMARY KEY);
CREATE TEMP TABLE _clean_exams (id uuid PRIMARY KEY);
CREATE TEMP TABLE _clean_questions (id uuid PRIMARY KEY);

INSERT INTO _clean_banks (id) VALUES
  ('e8f29688-cbb6-4ee6-8bb2-0b9ff6c4ba63'), -- HSK Demo 1 Bank
  ('073b71b7-71a1-4522-8d00-5d00844021fd'), -- Контрольная работа №1
  ('0575d22b-8adc-4da7-a3ef-5160442be568'); -- КР2

INSERT INTO _clean_templates (id) VALUES
  ('cd30c8e3-32a7-4d7b-8a8b-15ad31f09902'), -- HSK Demo 1 Template
  ('893f9087-b218-4f6a-8163-f662d28c197c'), -- Контрольная работа №1
  ('c334acb8-53ba-4bf7-8ad8-77f6179b0f1c'); -- КР2

INSERT INTO _clean_blueprints (id) VALUES
  ('8c04bec0-ccb9-4a47-9c8c-816bf1deb657'), -- HSK Demo 1 Blueprint
  ('4b4e8a29-4cbb-44e2-9bfb-6d63512d27b7'), -- Контрольная работа №1
  ('56bb32e5-a379-484d-a186-3f50c3334225'); -- Hsk 1 1

INSERT INTO _clean_exams (id) VALUES
  ('50035e54-2507-44ab-abdc-0cd8c9825bab'), -- HSK Demo 1
  ('20bbe0da-b546-4e8d-a4ec-9f81eadfb5bf'), -- Контрольная работа №1
  ('93a21d99-32f2-4a73-9219-626723d7fc82'), -- hsk1 1
  ('f16cadf0-bfbe-4fbe-8869-e7d0715b6fe7'); -- апрол

INSERT INTO _clean_questions (id)
SELECT id FROM assessment_questions WHERE bank_id IN (SELECT id FROM _clean_banks);

-- Safety: refuse if any non-target assessment rows exist outside these sets
DO $$
DECLARE
  extra_banks int;
  extra_exams int;
  extra_blueprints int;
  extra_templates int;
  extra_questions int;
BEGIN
  SELECT count(*) INTO extra_banks FROM assessment_banks WHERE id NOT IN (SELECT id FROM _clean_banks);
  SELECT count(*) INTO extra_exams FROM assessment_exams WHERE id NOT IN (SELECT id FROM _clean_exams);
  SELECT count(*) INTO extra_blueprints FROM assessment_blueprints WHERE id NOT IN (SELECT id FROM _clean_blueprints);
  SELECT count(*) INTO extra_templates FROM assessment_exam_templates WHERE id NOT IN (SELECT id FROM _clean_templates);
  SELECT count(*) INTO extra_questions FROM assessment_questions WHERE id NOT IN (SELECT id FROM _clean_questions);

  IF extra_banks > 0 OR extra_exams > 0 OR extra_blueprints > 0 OR extra_templates > 0 OR extra_questions > 0 THEN
    RAISE EXCEPTION 'Safety abort: unexpected assessment rows outside A+B+C (banks=%, exams=%, blueprints=%, templates=%, questions=%)',
      extra_banks, extra_exams, extra_blueprints, extra_templates, extra_questions;
  END IF;
END $$;

-- Pre-counts (deleted)
CREATE TEMP TABLE _deleted_counts (step int, table_name text, deleted_count int);

-- 1) Attempt answer selections
WITH del AS (
  DELETE FROM assessment_attempt_answer_selections s
  USING assessment_attempt_answers aa
  JOIN assessment_attempts a ON a.id = aa.attempt_id
  WHERE s.attempt_answer_id = aa.id
    AND a.exam_id IN (SELECT id FROM _clean_exams)
  RETURNING s.id
)
INSERT INTO _deleted_counts SELECT 1, 'assessment_attempt_answer_selections', count(*) FROM del;

-- 2) Attempt answers
WITH del AS (
  DELETE FROM assessment_attempt_answers aa
  USING assessment_attempts a
  WHERE aa.attempt_id = a.id
    AND a.exam_id IN (SELECT id FROM _clean_exams)
  RETURNING aa.id
)
INSERT INTO _deleted_counts SELECT 2, 'assessment_attempt_answers', count(*) FROM del;

-- 3) Answer snapshots (via question snapshots of clean attempts)
WITH del AS (
  DELETE FROM assessment_answer_snapshots ans
  USING assessment_question_snapshots qs
  JOIN assessment_attempts a ON a.id = qs.attempt_id
  WHERE ans.question_snapshot_id = qs.id
    AND a.exam_id IN (SELECT id FROM _clean_exams)
  RETURNING ans.id
)
INSERT INTO _deleted_counts SELECT 3, 'assessment_answer_snapshots', count(*) FROM del;

-- 4) Question snapshots
WITH del AS (
  DELETE FROM assessment_question_snapshots qs
  USING assessment_attempts a
  WHERE qs.attempt_id = a.id
    AND a.exam_id IN (SELECT id FROM _clean_exams)
  RETURNING qs.id
)
INSERT INTO _deleted_counts SELECT 4, 'assessment_question_snapshots', count(*) FROM del;

-- 5) Result breakdowns
WITH del AS (
  DELETE FROM assessment_result_breakdowns rb
  USING assessment_results r
  WHERE rb.result_id = r.id
    AND r.exam_id IN (SELECT id FROM _clean_exams)
  RETURNING rb.id
)
INSERT INTO _deleted_counts SELECT 5, 'assessment_result_breakdowns', count(*) FROM del;

-- 6) Results
WITH del AS (
  DELETE FROM assessment_results r
  WHERE r.exam_id IN (SELECT id FROM _clean_exams)
  RETURNING r.id
)
INSERT INTO _deleted_counts SELECT 6, 'assessment_results', count(*) FROM del;

-- 7) Attempts
WITH del AS (
  DELETE FROM assessment_attempts a
  WHERE a.exam_id IN (SELECT id FROM _clean_exams)
  RETURNING a.id
)
INSERT INTO _deleted_counts SELECT 7, 'assessment_attempts', count(*) FROM del;

-- 8) Assignments
WITH del AS (
  DELETE FROM assessment_exam_assignments a
  WHERE a.exam_id IN (SELECT id FROM _clean_exams)
  RETURNING a.id
)
INSERT INTO _deleted_counts SELECT 8, 'assessment_exam_assignments', count(*) FROM del;

-- 9) Exam questions
WITH del AS (
  DELETE FROM assessment_exam_questions eq
  WHERE eq.exam_id IN (SELECT id FROM _clean_exams)
  RETURNING eq.id
)
INSERT INTO _deleted_counts SELECT 9, 'assessment_exam_questions', count(*) FROM del;

-- 10) Sections
WITH del AS (
  DELETE FROM assessment_sections s
  WHERE s.exam_id IN (SELECT id FROM _clean_exams)
  RETURNING s.id
)
INSERT INTO _deleted_counts SELECT 10, 'assessment_sections', count(*) FROM del;

-- 11) Rules (exam-bound)
WITH del AS (
  DELETE FROM assessment_rules r
  WHERE r.exam_id IN (SELECT id FROM _clean_exams)
  RETURNING r.id
)
INSERT INTO _deleted_counts SELECT 11, 'assessment_rules', count(*) FROM del;

-- 12) Exams
WITH del AS (
  DELETE FROM assessment_exams e
  WHERE e.id IN (SELECT id FROM _clean_exams)
  RETURNING e.id
)
INSERT INTO _deleted_counts SELECT 12, 'assessment_exams', count(*) FROM del;

-- 13) Blueprint section rules
WITH del AS (
  DELETE FROM assessment_blueprint_section_rules bsr
  WHERE bsr.blueprint_id IN (SELECT id FROM _clean_blueprints)
  RETURNING bsr.id
)
INSERT INTO _deleted_counts SELECT 13, 'assessment_blueprint_section_rules', count(*) FROM del;

-- 14) Blueprints
WITH del AS (
  DELETE FROM assessment_blueprints b
  WHERE b.id IN (SELECT id FROM _clean_blueprints)
  RETURNING b.id
)
INSERT INTO _deleted_counts SELECT 14, 'assessment_blueprints', count(*) FROM del;

-- 15) Templates
WITH del AS (
  DELETE FROM assessment_exam_templates t
  WHERE t.id IN (SELECT id FROM _clean_templates)
  RETURNING t.id
)
INSERT INTO _deleted_counts SELECT 15, 'assessment_exam_templates', count(*) FROM del;

-- 16) Answers
WITH del AS (
  DELETE FROM assessment_answers a
  WHERE a.question_id IN (SELECT id FROM _clean_questions)
  RETURNING a.id
)
INSERT INTO _deleted_counts SELECT 16, 'assessment_answers', count(*) FROM del;

-- 17) Question attachments
WITH del AS (
  DELETE FROM assessment_question_attachments a
  WHERE a.question_id IN (SELECT id FROM _clean_questions)
  RETURNING a.id
)
INSERT INTO _deleted_counts SELECT 17, 'assessment_question_attachments', count(*) FROM del;

-- 18) Question topics
WITH del AS (
  DELETE FROM assessment_question_topics qt
  WHERE qt.question_id IN (SELECT id FROM _clean_questions)
  RETURNING qt.question_id, qt.topic_id
)
INSERT INTO _deleted_counts SELECT 18, 'assessment_question_topics', count(*) FROM del;

-- 19) Questions
WITH del AS (
  DELETE FROM assessment_questions q
  WHERE q.id IN (SELECT id FROM _clean_questions)
  RETURNING q.id
)
INSERT INTO _deleted_counts SELECT 19, 'assessment_questions', count(*) FROM del;

-- 20) Banks
WITH del AS (
  DELETE FROM assessment_banks b
  WHERE b.id IN (SELECT id FROM _clean_banks)
  RETURNING b.id
)
INSERT INTO _deleted_counts SELECT 20, 'assessment_banks', count(*) FROM del;

SELECT step, table_name, deleted_count
FROM _deleted_counts
ORDER BY step;

COMMIT;
