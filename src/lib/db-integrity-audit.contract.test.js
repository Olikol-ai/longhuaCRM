import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('teacher directory dropdown SSOT', () => {
  it('UserManagement loads teachers via api.teachers.list backed by canonical service', () => {
    const page = readFileSync(join(root, 'src/pages/UserManagement.jsx'), 'utf8');
    assert.match(page, /api\.teachers\.list\(\)/);
    const service = readFileSync(
      join(root, 'apps/api/src/modules/teachers/teachers.service.ts'),
      'utf8',
    );
    assert.match(service, /buildActiveDirectoryQuery/);
    assert.match(service, /return this\.findActive\(\)/);
  });

  it('db:audit script exists at project root', () => {
    const pkg = readFileSync(join(root, 'package.json'), 'utf8');
    assert.match(pkg, /"db:audit"/);
    const auditScript = readFileSync(
      join(root, 'apps/api/scripts/audit-database-integrity.ts'),
      'utf8',
    );
    assert.match(auditScript, /DATABASE INTEGRITY AUDIT/);
  });
});
