import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('teacher exam assign + description UX', () => {
  it('wires teacher assign action and shared assignment dialog', () => {
    const teacher = read('src/pages/TeacherAssessment.jsx');
    const dialog = read('src/components/assessment/AssignmentCreateDialog.jsx');
    const layout = read('src/Layout.jsx');
    const access = read(
      'apps/api/src/common/access/assessment-access.service.ts',
    );
    const assignment = read(
      'apps/api/src/modules/assessment/services/assignment.service.ts',
    );

    assert.match(teacher, /Назначить экзамен/);
    assert.match(teacher, /mode="teacher"/);
    assert.match(teacher, /AssignmentCreateDialog/);
    assert.match(dialog, /mode === 'teacher'|teacherMode/);
    assert.match(dialog, /assign-exam-confirm/);
    assert.match(layout, /TeacherAssessment/);
    assert.match(layout, /Мои экзамены/);

    assert.match(access, /assertCanAssignTarget/);
    assert.match(access, /Вы не можете назначить экзамен этому ученику/);
    assert.match(access, /assignedTeacherId/);
    assert.match(assignment, /assertCanCreateAssignment\(/);
    assert.match(assignment, /Этот экзамен уже назначен/);
  });

  it('stores and surfaces exam.description end-to-end', () => {
    const entity = read(
      'apps/api/src/modules/assessment/entities/assessment-exam.entity.ts',
    );
    const migration = read(
      'apps/api/src/database/migrations/1746600000000-AssessmentExamDescription.ts',
    );
    const createDto = read(
      'apps/api/src/modules/assessment/dto/exams/create-exam.dto.ts',
    );
    const updateDto = read(
      'apps/api/src/modules/assessment/dto/exams/update-exam.dto.ts',
    );
    const examService = read(
      'apps/api/src/modules/assessment/services/exam.service.ts',
    );
    const createUi = read('src/components/assessment/ExamCreateDialog.jsx');
    const detailUi = read('src/pages/AssessmentExamDetail.jsx');
    const studentHook = read('src/hooks/useStudentExamCards.js');
    const card = read('src/components/assessment/ExamAssignmentCard.jsx');
    const studentPage = read('src/pages/StudentExams.jsx');

    assert.match(entity, /description: string \| null/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS "description"/);
    assert.match(createDto, /description\?:/);
    assert.match(updateDto, /description\?:/);
    assert.match(examService, /normalizeExamDescription/);
    assert.match(createUi, /exam-description-input/);
    assert.match(detailUi, /exam-detail-description/);
    assert.match(studentHook, /exam\?\.description/);
    assert.match(card, /exam-card-description/);
    assert.match(card, /Начать экзамен/);
    assert.match(studentPage, /Мои экзамены/);
    assert.doesNotMatch(card, /applyScope|recurrenceSeriesId/);
  });
});
