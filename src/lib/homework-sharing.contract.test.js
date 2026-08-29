import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('Homework teacher sharing', () => {
  it('API client exposes grant/revoke/list/bulk access methods', () => {
    const api = readFileSync(join(root, 'src/api/homework.api.js'), 'utf8');
    assert.match(api, /grantAccess/);
    assert.match(api, /revokeAccess/);
    assert.match(api, /bulkGrant/);
    assert.match(api, /bulkRevoke/);
    assert.match(api, /listAccess/);
    assert.match(api, /\/homework\/access\/grant/);
    assert.match(api, /\/homework\/access\/bulk-grant/);
  });

  it('HomeworkList has mine/shared segments, bulk grant, and shared author marker', () => {
    const list = readFileSync(join(root, 'src/pages/HomeworkList.jsx'), 'utf8');
    assert.match(list, /Доступные мне/);
    assert.match(list, /homework-segment-\$\{seg\.id\}|homework-segment-shared/);
    assert.match(list, /homework-bulk-grant/);
    assert.match(list, /Предоставить доступ/);
    assert.match(list, /Управление доступом/);
    assert.match(list, /Доступ предоставлен вам/);
    assert.match(list, /HomeworkGrantAccessDialog/);
    assert.match(list, /HomeworkAccessManageDialog/);
    assert.match(list, /isSharedHomework|access_role/);
  });

  it('mobile homework actions use compact menu, not a button column grid', () => {
    const list = readFileSync(join(root, 'src/pages/HomeworkList.jsx'), 'utf8');
    assert.match(list, /compact:\s*true|compact = false/);
    assert.match(list, /DropdownMenu|MoreVertical/);
    assert.match(list, /homework-actions-\$/);
    assert.doesNotMatch(list, /grid grid-cols-2 gap-2">\{renderActions/);
  });

  it('grant and manage dialogs wire revoke and peer search', () => {
    const grant = readFileSync(
      join(root, 'src/components/homework/HomeworkGrantAccessDialog.jsx'),
      'utf8',
    );
    const manage = readFileSync(
      join(root, 'src/components/homework/HomeworkAccessManageDialog.jsx'),
      'utf8',
    );
    assert.match(grant, /homework-grant-access-dialog/);
    assert.match(grant, /bulkGrant/);
    assert.match(grant, /chatsApi\.directory/);
    assert.match(manage, /homework-access-manage-dialog/);
    assert.match(manage, /bulkRevoke/);
    assert.match(manage, /Отозвать/);
  });

  it('assignment page keeps shared published templates selectable', () => {
    const page = readFileSync(join(root, 'src/pages/HomeworkAssignment.jsx'), 'utf8');
    assert.match(page, /api\.homework\.list\(\)/);
    assert.match(page, /status === 'published'/);
    assert.doesNotMatch(page, /teacher_id\s*===/);
    assert.doesNotMatch(page, /created_by_user_id\s*===/);
    assert.match(page, /access_role === 'shared'|is_shared/);
  });

  it('backend has homework_access entity, migration, and ACL endpoints', () => {
    const entity = readFileSync(
      join(root, 'apps/api/src/modules/homework/entities/homework-access.entity.ts'),
      'utf8',
    );
    const migration = readFileSync(
      join(root, 'apps/api/src/database/migrations/1746700000000-HomeworkAccess.ts'),
      'utf8',
    );
    const controller = readFileSync(
      join(root, 'apps/api/src/modules/homework/controllers/homework.controller.ts'),
      'utf8',
    );
    const service = readFileSync(
      join(root, 'apps/api/src/modules/homework/services/homework.service.ts'),
      'utf8',
    );
    assert.match(entity, /homework_access/);
    assert.match(entity, /granteeUserId/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS "homework_access"/);
    assert.match(controller, /access\/grant/);
    assert.match(controller, /access\/bulk-revoke/);
    assert.match(controller, /:id\/access/);
    assert.match(service, /assertCanAssignHomework/);
    assert.match(service, /hasHomeworkAccessGrant/);
    assert.match(service, /access_role/);
  });
});
