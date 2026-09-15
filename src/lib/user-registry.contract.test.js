import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRegistryQuery,
  hasActiveFilters,
  parseRegistryFilters,
  serializeRegistryFilters,
  toggleSort,
} from './user-registry.utils.js';

describe('user registry URL + query utils', () => {
  it('parses and serializes filters', () => {
    const params = new URLSearchParams('search=ivan&roles=teacher,student&statuses=active&page=2&limit=50');
    const parsed = parseRegistryFilters(params);
    assert.equal(parsed.search, 'ivan');
    assert.deepEqual(parsed.roles, ['teacher', 'student']);
    assert.deepEqual(parsed.statuses, ['active']);
    assert.equal(parsed.page, 2);
    assert.equal(parsed.limit, 50);

    const back = serializeRegistryFilters(parsed);
    assert.equal(back.get('search'), 'ivan');
    assert.equal(back.get('roles'), 'teacher,student');
    assert.equal(back.get('page'), '2');
  });

  it('builds API query from filters', () => {
    const query = buildRegistryQuery({
      search: 'test@mail.ru',
      roles: ['user'],
      statuses: [],
      createdFrom: '2026-01-01T00:00:00.000Z',
      createdTo: '',
      assignedTeacherId: 'none',
      sort: 'created_date',
      sortDir: 'desc',
      page: 1,
      limit: 25,
    });
    assert.equal(query.search, 'test@mail.ru');
    assert.equal(query.roles, 'user');
    assert.equal(query.assignedTeacherId, 'none');
    assert.equal(query.sort, 'created_date');
    assert.equal(query.sortDir, 'desc');
  });

  it('detects active filters', () => {
    assert.equal(hasActiveFilters({ search: '', roles: [], statuses: [] }), false);
    assert.equal(hasActiveFilters({ search: 'a', roles: [], statuses: [] }), true);
    assert.equal(hasActiveFilters({ search: '', roles: ['admin'], statuses: [] }), true);
  });

  it('toggles sort direction', () => {
    assert.deepEqual(toggleSort('name', 'asc', 'name'), { sort: 'name', sortDir: 'desc' });
    assert.deepEqual(toggleSort('name', 'desc', 'created_date'), { sort: 'created_date', sortDir: 'asc' });
  });
});

describe('UserManagement page contract', () => {
  it('uses single registry table without sub-tabs', async () => {
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
    const page = readFileSync(join(root, 'src/pages/UserManagement.jsx'), 'utf8');
    assert.match(page, /api\.users\.registry/);
    assert.match(page, /deletePendingRegistration/);
    assert.match(page, /entry_type === 'pending_registration'/);
    assert.match(page, /ExcelColumnFilter/);
    assert.match(page, /MobileFilterToolbar/);
    assert.match(page, /MobileMultiSelect/);
    assert.match(page, /UserMobileCard/);
    assert.match(page, /UserEditDialog/);
    assert.match(page, /useSearchParams/);
    assert.match(page, /lg:hidden space-y-3/);
    assert.doesNotMatch(page, /activeTab/);
    assert.doesNotMatch(page, /StudentsTab/);
    assert.doesNotMatch(page, /TeachersTab/);
    assert.doesNotMatch(page, /TutorsTab/);
    assert.doesNotMatch(page, /ACCOUNT_FILTER_TABS/);
  });
});

describe('admin mobile filter pattern', () => {
  it('ships reusable mobile filter components', async () => {
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
    const toolbar = readFileSync(join(root, 'src/components/responsive/MobileFilterToolbar.jsx'), 'utf8');
    const chips = readFileSync(join(root, 'src/components/responsive/MobileFilterChips.jsx'), 'utf8');
    const fields = readFileSync(join(root, 'src/components/responsive/MobileFilterFields.jsx'), 'utf8');
    const balance = readFileSync(join(root, 'src/pages/Balance.jsx'), 'utf8');
    assert.match(toolbar, /SearchField/);
    assert.match(toolbar, /Фильтры/);
    assert.match(chips, /Сбросить всё/);
    assert.match(fields, /MobileMultiSelect/);
    assert.match(balance, /MobileFilterToolbar/);
    assert.match(balance, /openMobileFilters/);
  });
});

describe('UserEditDialog teacher availability tab', () => {
  it('reuses TeacherAvailabilityView for teacher role only', async () => {
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
    const dialog = readFileSync(join(root, 'src/components/users/UserEditDialog.jsx'), 'utf8');
    assert.match(dialog, /TeacherAvailabilityView/);
    assert.match(dialog, /teacher_profile_id/);
    assert.match(dialog, /Свободное расписание/);
    assert.match(dialog, /isTeacher && tab === 'availability'/);
    assert.match(dialog, /Профиль преподавателя не найден/);
    assert.doesNotMatch(dialog, /checkTeacherAvailability/);
    assert.doesNotMatch(dialog, /findAvailableForSlot/);
    assert.doesNotMatch(dialog, /api\.teachers\.list/);
  });
});
