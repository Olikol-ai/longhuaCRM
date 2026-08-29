import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('Admin Dashboard SSOT contract', () => {
  it('loads KPIs from GET /dashboard/admin, not list.length over teachers/lessons', () => {
    const dash = readFileSync(
      join(root, 'src/components/dashboard/AdminDashboard.jsx'),
      'utf8',
    );
    const api = readFileSync(join(root, 'src/api/dashboard.api.js'), 'utf8');

    assert.match(dash, /api\.dashboard/);
    assert.match(dash, /adminSummary\(/);
    assert.match(dash, /counts\.teachers/);
    assert.match(dash, /counts\.students/);
    assert.match(dash, /counts\.lessons_today/);
    assert.match(dash, /counts\.lessons_tomorrow/);
    assert.doesNotMatch(dash, /api\.teachers\.list/);
    assert.doesNotMatch(dash, /api\.lessons\.list/);
    assert.doesNotMatch(dash, /teachers\.filter/);
    assert.doesNotMatch(dash, /\blocalStorage\b|\bsessionStorage\b/);
    assert.doesNotMatch(dash, /list\("-date"/);

    assert.match(api, /\/dashboard\/admin/);
    assert.match(api, /no-store/);
  });

  it('backend exposes canonical teacher count with user role=teacher join', () => {
    const teachers = readFileSync(
      join(root, 'apps/api/src/modules/teachers/teachers.service.ts'),
      'utf8',
    );
    const service = readFileSync(
      join(root, 'apps/api/src/modules/dashboard/admin-dashboard.service.ts'),
      'utf8',
    );
    const controller = readFileSync(
      join(root, 'apps/api/src/modules/dashboard/dashboard.controller.ts'),
      'utf8',
    );

    assert.match(teachers, /async countActive/);
    assert.match(teachers, /u\.role = :role/);
    assert.match(teachers, /role: 'teacher'/);
    assert.match(service, /teachers\.countActive/);
    assert.match(service, /listNonCancelledByDatesForAdmin/);
    assert.match(controller, /@Get\('admin'\)/);
    assert.match(controller, /Cache-Control.*no-store|no-store/);
  });
});
