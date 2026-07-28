import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('Student registration without referral', () => {
  it('Login does not reuse sticky sessionStorage invite without ?ref=', () => {
    const login = readFileSync(join(root, 'src/pages/Login.jsx'), 'utf8');
    assert.match(login, /sessionStorage\.removeItem\(INVITE_REF_KEY\)/);
    assert.match(login, /inviteFromQuery \|\| inviteToken/);
    assert.doesNotMatch(
      login,
      /inviteToken \|\| sessionStorage\.getItem\(INVITE_REF_KEY\)/,
    );
  });

  it('admin Students tab exposes awaiting teacher assignment filter', () => {
    const page = readFileSync(join(root, 'src/pages/UserManagement.jsx'), 'utf8');
    assert.match(page, /Ожидают назначения преподавателя/);
    assert.match(page, /pending_assignment/);
    assert.match(page, /students-filter-pending-assignment/);
  });

  it('student profile sync clears orphan teacher without invite', () => {
    const sync = readFileSync(
      join(root, 'apps/api/src/modules/users/role-entity-sync.service.ts'),
      'utf8',
    );
    assert.match(sync, /pending_assignment/);
    assert.match(sync, /wasUnlinked/);
    assert.match(sync, /never inherit orphan/i);
    assert.doesNotMatch(sync, /findOne\(\{\s*where:\s*\{\s*status:\s*'active'/);
  });
});
