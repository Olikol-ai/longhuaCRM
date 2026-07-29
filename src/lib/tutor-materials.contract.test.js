import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('tutor materials ACL contract', () => {
  it('allows tutor role on materials controller mutations', () => {
    const src = read('apps/api/src/modules/materials/materials.controller.ts');
    assert.match(src, /@Roles\('admin', 'teacher', 'tutor'\)/);
    assert.match(src, /createMaterial/);
    assert.match(src, /grantAccess/);
  });

  it('scopes tutor materials to own creations in domain access', () => {
    const src = read(
      'apps/api/src/common/access/materials-domain-access.service.ts',
    );
    assert.match(src, /role !== 'tutor'/);
    assert.match(src, /role === 'tutor'/);
    assert.match(src, /createdByUserId: actor\.sub/);
    assert.match(src, /role === 'tutor_student'/);
  });

  it('extends MaterialAccess with tutor_student target and TUTOR role', () => {
    const dto = read(
      'apps/api/src/modules/materials/dto/grant-material-access.dto.ts',
    );
    const entity = read(
      'apps/api/src/modules/materials/entities/material-access.entity.ts',
    );
    const service = read(
      'apps/api/src/modules/materials/material-access.service.ts',
    );
    assert.match(dto, /tutor_student/);
    assert.match(dto, /TUTOR/);
    assert.match(entity, /tutorStudentId/);
    assert.match(service, /grantToTutorStudent/);
    assert.match(
      service,
      /Преподаватель не может выдавать материалы ученикам репетитора/,
    );
    assert.match(
      service,
      /Репетитор может выдавать доступ только своим ученикам/,
    );
  });

  it('preserves grants when local tutor student links to a user', () => {
    const sync = read(
      'apps/api/src/modules/users/role-entity-sync.service.ts',
    );
    assert.match(sync, /MaterialAccessEntity/);
    assert.match(sync, /tutorStudentId: row\.id/);
    assert.match(sync, /userId: user\.id/);
  });

  it('exposes MaterialsHub to tutors in the SPA', () => {
    const layout = read('src/Layout.jsx');
    const app = read('src/App.jsx');
    const route = read('src/components/auth/AdminRoute.jsx');
    assert.match(layout, /tutorNav[\s\S]*MaterialsHub/);
    assert.match(app, /allowTutor/);
    assert.match(route, /allowTutor/);
  });
});
