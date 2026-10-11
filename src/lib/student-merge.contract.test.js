import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('student merge UX + API contract', () => {
  it('registry service includes orphan student profiles', async () => {
    const source = readFileSync(
      join(root, 'apps/api/src/modules/users/user-registry.service.ts'),
      'utf8',
    );
    assert.match(source, /studentProfileToRegistryItem/);
    assert.match(source, /s\.user_id IS NULL/);
  });

  it('UserManagement supports student_profile delete and account status filter', () => {
    const page = readFileSync(join(root, 'src/pages/UserManagement.jsx'), 'utf8');
    assert.match(page, /student_profile/);
    assert.match(page, /ACCOUNT_STATUS_OPTIONS/);
    assert.match(page, /StudentMergeDialog/);
  });

  it('students API exposes merge endpoints client with primary in path', () => {
    const apiClient = readFileSync(join(root, 'src/api/students.api.js'), 'utf8');
    assert.match(apiClient, /mergeCandidates/);
    assert.match(apiClient, /\/\$\{primaryStudentId\}\/merge/);
    assert.match(apiClient, /secondaryStudentId/);
  });

  it('StudentMergeDialog locks primary to clicked account and shows both sides', () => {
    const dialog = readFileSync(
      join(root, 'src/components/users/StudentMergeDialog.jsx'),
      'utf8',
    );
    assert.match(dialog, /primaryStudentId = user\?\.student_profile_id/);
    assert.match(dialog, /lockedPrimaryId/);
    assert.match(dialog, /Основной аккаунт \(останется\)/);
    assert.match(dialog, /Присоединяемый аккаунт/);
    assert.match(dialog, /merge-confirm-summary/);
    assert.match(dialog, /api\.students\.merge\(lockedPrimaryId, lockedSecondaryId\)/);
    assert.doesNotMatch(dialog, /createdAt|lessonCount|choosePrimary|swapPrimary/);
  });
});
