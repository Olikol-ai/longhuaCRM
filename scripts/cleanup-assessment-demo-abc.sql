-- Legacy A+B+C cleanup script targeted blueprint/template rows.
-- Those tables are dropped by DropAssessmentBlueprintTemplate1742900000000.
-- This script is intentionally a no-op safety notice.

DO $$
BEGIN
  RAISE NOTICE 'Blueprint/template cleanup is obsolete. Use ExamBlock/Exam admin flows.';
END $$;
