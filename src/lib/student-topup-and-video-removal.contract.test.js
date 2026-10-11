import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('student self top-up removed; admin payments kept', () => {
  it('StudentDashboard has no top-up button or modal', () => {
    const dash = read('src/pages/StudentDashboard.jsx');
    assert.doesNotMatch(dash, /Пополнить баланс|TopUpModal|showTopUp/);
    assert.equal(existsSync(join(root, 'src/components/student/TopUpModal.jsx')), false);
    assert.equal(existsSync(join(root, 'src/pages/PaymentReturn.jsx')), false);
  });

  it('admin Balance and Payments pages remain', () => {
    assert.equal(existsSync(join(root, 'src/pages/Balance.jsx')), true);
    assert.equal(existsSync(join(root, 'src/pages/Payments.jsx')), true);
    assert.match(read('src/App.jsx'), /path="\/Balance"|Balance/);
    assert.match(read('src/App.jsx'), /path="\/Payments"/);
  });

  it('Alfa student self-init is admin-only', () => {
    const ctrl = read('apps/api/src/modules/alfabank/payments-alfa.controller.ts');
    assert.match(ctrl, /@Roles\('admin'\)/);
    assert.doesNotMatch(ctrl, /@Roles\('student',\s*'admin'\)/);
  });
});

describe('in-app video calling removed', () => {
  it('video stack files are gone', () => {
    assert.equal(existsSync(join(root, 'src/components/video')), false);
    assert.equal(existsSync(join(root, 'apps/api/src/modules/video')), false);
    assert.equal(existsSync(join(root, 'src/pages/LessonVideo.jsx')), false);
    assert.equal(existsSync(join(root, 'src/lib/VideoSessionContext.jsx')), false);
  });

  it('App has no video route or provider', () => {
    const app = read('src/App.jsx');
    assert.doesNotMatch(app, /VideoSessionProvider|VideoSessionLayer|LessonVideo|\/lesson\/:id\/video/);
  });

  it('dashboards do not offer video lesson buttons', () => {
    for (const rel of [
      'src/pages/StudentDashboard.jsx',
      'src/pages/StudentLessons.jsx',
      'src/pages/TeacherDashboard.jsx',
      'src/components/dashboard/TeacherRoleDashboard.jsx',
      'src/components/dashboard/LessonRow.jsx',
      'src/pages/TutorSchedule.jsx',
      'src/components/schedule/SchoolScheduleCalendar.jsx',
    ]) {
      const src = read(rel);
      assert.doesNotMatch(src, /видеоурок|lessonVideoPath|\/lesson\/.*\/video/, rel);
    }
  });
});
