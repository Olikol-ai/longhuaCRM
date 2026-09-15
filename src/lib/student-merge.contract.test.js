import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('student without account in admin registry', () => {
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

  it('students API exposes merge endpoints client', () => {
    const apiClient = readFileSync(join(root, 'src/api/students.api.js'), 'utf8');
    assert.match(apiClient, /mergeCandidates/);
    assert.match(apiClient, /\/merge/);
  });
});
