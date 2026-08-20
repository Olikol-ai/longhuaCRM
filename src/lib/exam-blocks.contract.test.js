import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('Exam generation and legacy ExamBlocks contract', () => {
  it('creates exams from generation parts in UI', () => {
    const api = readFileSync(join(root, 'src/api/assessment.api.js'), 'utf8');
    assert.match(api, /listReadingTasks/);
    assert.match(api, /listListeningTasks/);
    assert.match(api, /createExam/);
    assert.doesNotMatch(api, /listContentTasks/);
    assert.doesNotMatch(api, /exam-templates/);
    assert.doesNotMatch(api, /\/assessment\/blueprints/);

    const dialog = readFileSync(
      join(root, 'src/components/assessment/ExamCreateDialog.jsx'),
      'utf8',
    );
    assert.match(dialog, /parts/);
    assert.match(dialog, /select_count/);
    assert.match(dialog, /listReadingTasks/);
    assert.match(dialog, /listListeningTasks/);
    assert.doesNotMatch(dialog, /listContentTasks/);
    assert.doesNotMatch(dialog, /block_ids/);
    assert.doesNotMatch(dialog, /blueprint/);
  });

  it('registers ExamBlocks and drop-blueprint migrations (legacy schema kept)', () => {
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

    const dropBanks = readFileSync(
      join(
        root,
        'apps/api/src/database/migrations/1743000000000-DropAssessmentBanks.ts',
      ),
      'utf8',
    );
    assert.match(dropBanks, /DROP TABLE IF EXISTS assessment_banks/);
    assert.match(dropBanks, /DROP COLUMN IF EXISTS bank_id/);

    const moduleSrc = readFileSync(
      join(root, 'apps/api/src/modules/assessment/assessment.module.ts'),
      'utf8',
    );
    assert.match(moduleSrc, /AssessmentExamBlocksController/);
    assert.match(moduleSrc, /AssessmentReadingTasksController/);
    assert.match(moduleSrc, /AssessmentListeningTasksController/);
    assert.doesNotMatch(moduleSrc, /AssessmentBanksController/);
    assert.doesNotMatch(moduleSrc, /BlueprintsController/);
    assert.doesNotMatch(moduleSrc, /ExamTemplatesController/);
  });

  it('supports parts generation and legacy blocks in ExamService', () => {
    const examService = readFileSync(
      join(root, 'apps/api/src/modules/assessment/services/exam.service.ts'),
      'utf8',
    );
    assert.match(examService, /createFromParts/);
    assert.match(examService, /materializeFromBlocks/);
    assert.doesNotMatch(examService, /blueprint/);
    assert.doesNotMatch(examService, /createFromBlueprint/);
  });

  it('removes blueprint/template frontend pages', () => {
    assert.equal(existsSync(join(root, 'src/pages/AssessmentBlueprints.jsx')), false);
    assert.equal(existsSync(join(root, 'src/pages/AssessmentExamTemplates.jsx')), false);
    assert.equal(existsSync(join(root, 'src/pages/AssessmentBlueprintEdit.jsx')), false);
  });

  it('removes unused ExamBlocks authoring UI (API legacy remains)', () => {
    assert.equal(existsSync(join(root, 'src/pages/AssessmentExamBlocks.jsx')), false);
    assert.equal(existsSync(join(root, 'src/pages/AssessmentExamBlockEdit.jsx')), false);
    assert.equal(existsSync(join(root, 'src/hooks/useAssessmentExamBlocks.js')), false);
    assert.equal(existsSync(join(root, 'src/pages/Attendance.jsx')), false);
  });
});
