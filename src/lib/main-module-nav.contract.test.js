import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

/** Main sidebar entry pages must not show breadcrumb “← …” back links. */
const MAIN_MODULE_PAGES = [
  'src/pages/AssessmentQuestions.jsx',
  'src/pages/AssessmentExams.jsx',
  'src/pages/HomeworkList.jsx',
  'src/pages/MaterialsHub.jsx',
  'src/pages/TeacherStudents.jsx',
  'src/pages/TutorStudents.jsx',
  'src/pages/TeacherSchedule.jsx',
  'src/pages/TutorSchedule.jsx',
  'src/pages/Schedule.jsx',
  'src/pages/TutorStats.jsx',
  'src/pages/Profile.jsx',
  'src/pages/TutorProfile.jsx',
  'src/pages/Settings.jsx',
  'src/pages/AdminAssessment.jsx',
  'src/pages/TeacherAssessment.jsx',
  'src/pages/StudentExams.jsx',
  'src/pages/HomeworkViewer.jsx',
];

const BACK_LINK_RE = /←\s*(Экзамены|Назад|Вернуться|К списку|Мои экзамены)/;

describe('Main module navigation (no orphan back links)', () => {
  for (const rel of MAIN_MODULE_PAGES) {
    it(`${rel} has no breadcrumb back link to another module`, () => {
      const source = readFileSync(join(root, rel), 'utf8');
      assert.doesNotMatch(source, BACK_LINK_RE);
    });
  }

  it('keeps child-page back links to their parent lists', () => {
    const examDetail = readFileSync(
      join(root, 'src/pages/AssessmentExamDetail.jsx'),
      'utf8',
    );
    const assignments = readFileSync(
      join(root, 'src/pages/AssessmentAssignments.jsx'),
      'utf8',
    );
    assert.match(examDetail, /← Экзамены/);
    assert.match(assignments, /← Экзамены/);
  });
});
