import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  filterSchoolTeacherLessons,
  isSchoolTeacherLesson,
} from './schoolSchedule.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('schoolSchedule filter', () => {
  it('keeps only teacher-owned lessons', () => {
    const rows = [
      { id: '1', teacher_id: 't1', tutor_id: null },
      { id: '2', teacher_id: null, tutor_id: 'u1' },
      { id: '3', teacherId: 't2' },
      { id: '4', tutorId: 'u2' },
    ];
    const filtered = filterSchoolTeacherLessons(rows);
    assert.equal(filtered.length, 2);
    assert.ok(filtered.every((r) => isSchoolTeacherLesson(r)));
    assert.ok(!filtered.some((r) => r.id === '2' || r.id === '4'));
  });
});

describe('tutor workspace routes source', () => {
  it('registers tutor pages and admin tutors tab', () => {
    const srcRoot = join(__dirname, '..');
    const pagesConfig = readFileSync(join(srcRoot, 'pages.config.js'), 'utf8');
    const layout = readFileSync(join(srcRoot, 'Layout.jsx'), 'utf8');
    const adminPanel = readFileSync(join(srcRoot, 'pages', 'AdminPanel.jsx'), 'utf8');
    const routing = readFileSync(join(srcRoot, 'lib', 'routing.js'), 'utf8');

    assert.match(pagesConfig, /TutorSchedule/);
    assert.match(pagesConfig, /TutorStudents/);
    assert.match(pagesConfig, /TutorStats/);
    assert.match(pagesConfig, /TutorReferralLinks/);
    assert.match(layout, /TutorSchedule/);
    assert.match(layout, /TutorReferralLinks/);
    assert.match(adminPanel, /AdminTutors/);
    assert.match(adminPanel, /Репетиторы/);
    assert.match(routing, /TutorSchedule/);
    assert.match(routing, /TutorReferralLinks/);
  });
});
