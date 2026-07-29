-- Post-check after assessment demo cleanup (blocks-based schema).
SELECT 'assessment_exam_blocks' AS entity, count(*) FROM assessment_exam_blocks
UNION ALL
SELECT 'assessment_exam_block_items', count(*) FROM assessment_exam_block_items
UNION ALL
SELECT 'assessment_exams', count(*) FROM assessment_exams;
