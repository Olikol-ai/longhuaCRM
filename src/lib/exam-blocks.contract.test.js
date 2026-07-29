import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('ExamBlocks migration contract', () => {
  it('exposes block API client methods and create-from-blocks only', () => {
    const api = readFileSync(join(root, 'src/api/assessment.api.js'), 'utf8');
    assert.match(api, /listExamBlocks/);
    assert.match(api, /createExamBlock/);
    assert.match(api, /\/assessment\/blocks/);
    assert.doesNotMatch(api, /exam-templates/);
    assert.doesNotMatch(api, /\/assessment\/blueprints/);

    const dialog = readFileSync(
      join(root, 'src/components/assessment/ExamCreateDialog.jsx'),
      'utf8',
    );
    assert.match(dialog, /block_ids/);
    assert.match(dialog, /listExamBlocks/);
    assert.doesNotMatch(dialog, /blueprint/);
  });

  it('registers ExamBlocks and drop-blueprint migrations', () => {
    const migration = readFileSync(
      join(
        root,
        'apps/api/src/database/migrations/1742800000000-ExamBlocksAndChangeJournal.ts',
      ),
      'utf8',
    );
    assert.match(migration, /assessment_exam_blocks/);
    assert.match(migration, /assessment_change_journal/);

    const drop = readFileSync(
      join(
        root,
        'apps/api/src/database/migrations/1742900000000-DropAssessmentBlueprintTemplate.ts',
      ),
      'utf8',
    );
    assert.match(drop, /DROP TABLE IF EXISTS assessment_blueprints/);
    assert.match(drop, /DROP TABLE IF EXISTS assessment_exam_templates/);
    assert.match(drop, /DROP COLUMN IF EXISTS blueprint_id/);

    const moduleSrc = readFileSync(
      join(root, 'apps/api/src/modules/assessment/assessment.module.ts'),
      'utf8',
    );
    assert.match(moduleSrc, /AssessmentExamBlocksController/);
    assert.doesNotMatch(moduleSrc, /BlueprintsController/);
    assert.doesNotMatch(moduleSrc, /ExamTemplatesController/);
  });

  it('creates exams from blocks only in ExamService', () => {
    const examService = readFileSync(
      join(root, 'apps/api/src/modules/assessment/services/exam.service.ts'),
      'utf8',
    );
    assert.match(examService, /materializeFromBlocks/);
    assert.doesNotMatch(examService, /blueprint/);
    assert.doesNotMatch(examService, /createFromBlueprint/);
  });

  it('removes blueprint/template frontend pages', () => {
    assert.equal(existsSync(join(root, 'src/pages/AssessmentBlueprints.jsx')), false);
    assert.equal(existsSync(join(root, 'src/pages/AssessmentExamTemplates.jsx')), false);
    assert.equal(existsSync(join(root, 'src/pages/AssessmentBlueprintEdit.jsx')), false);
  });
});
