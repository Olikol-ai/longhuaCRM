import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

describe('lesson recurrence date reschedule contract', () => {
  it('backend uses original anchor date for following cutoff, not new date', () => {
    const source = fs.readFileSync(
      path.join(root, 'apps/api/src/modules/lessons/lesson-recurrence.service.ts'),
      'utf8',
    );
    assert.match(source, /originalAnchorDate/);
    assert.match(source, /computeSeriesDateMoves/);
    assert.match(source, /applySeriesDateMoves/);
    assert.doesNotMatch(source, /regenerateFrom/);
  });

  it('frontend scope dialog and unified update payload remain wired', () => {
    const modal = fs.readFileSync(
      path.join(root, 'src/components/schedule/LessonDetailModal.jsx'),
      'utf8',
    );
    const dialog = fs.readFileSync(
      path.join(root, 'src/components/schedule/RecurrenceApplyScopeDialog.jsx'),
      'utf8',
    );
    assert.match(modal, /RecurrenceApplyScopeDialog/);
    assert.match(modal, /needsScopePrompt/);
    assert.match(modal, /apply_scope = scope/);
    assert.match(dialog, /Только это занятие/);
    assert.match(dialog, /Это занятие и все последующие/);
    assert.match(dialog, /Всю серию/);
  });

  it('schedule entry points reload from API after update', () => {
    const schedule = fs.readFileSync(path.join(root, 'src/pages/Schedule.jsx'), 'utf8');
    const teacher = fs.readFileSync(path.join(root, 'src/pages/TeacherSchedule.jsx'), 'utf8');
    const tutor = fs.readFileSync(path.join(root, 'src/pages/TutorSchedule.jsx'), 'utf8');
    const group = fs.readFileSync(path.join(root, 'src/pages/GroupDetail.jsx'), 'utf8');

    assert.match(schedule, /await api\.lessons\.update\(id, data\)[\s\S]*await load\(\)/);
    assert.match(teacher, /await api\.lessons\.update\(id, data\)[\s\S]*await loadData\(\)/);
    assert.match(tutor, /await api\.lessons\.update\(id, data\)[\s\S]*await loadData\(\)/);
    assert.match(group, /await api\.lessons\.update\(id, data\)[\s\S]*await load\(\)/);
  });
});
