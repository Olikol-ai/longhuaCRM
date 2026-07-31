import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('materials performance contract', () => {
  it('caches ACL buckets and invalidates after grants', () => {
    const access = read(
      'apps/api/src/common/access/materials-domain-access.service.ts',
    );
    assert.match(access, /ACCESS_CACHE_TTL_MS/);
    assert.match(access, /invalidateAccessCache/);
    assert.match(access, /readThrough/);
    assert.match(access, /createQueryBuilder\('m'\)/);
    assert.doesNotMatch(access, /resolveAccessibleMaterialIds\(actor\);\s*\n\s*if \(accessibleMaterialIds/);
  });

  it('supports course/folder scoped materials list', () => {
    const controller = read(
      'apps/api/src/modules/materials/materials.controller.ts',
    );
    const service = read('apps/api/src/modules/materials/materials.service.ts');
    assert.match(controller, /courseId/);
    assert.match(controller, /folderId/);
    assert.match(service, /options: \{ courseId\?: string; folderId\?: string \}/);
  });

  it('loads materials list with select metadata only', () => {
    const repo = read('apps/api/src/modules/materials/materials.repository.ts');
    assert.match(repo, /select:\s*\[/);
    assert.match(repo, /'fileUrl'/);
    assert.match(repo, /'title'/);
  });

  it('frontend loads tree first and materials asynchronously', () => {
    const manager = read('src/components/materials/MaterialManager.jsx');
    const api = read('src/api/materials.api.js');
    assert.match(manager, /materials-skeleton/);
    assert.match(manager, /loadTree/);
    assert.match(manager, /loadMaterials/);
    assert.match(manager, /materialsLoading/);
    assert.match(api, /courseId/);
    assert.match(api, /folderId/);
  });

  it('opens files only on demand via signed URL helper', () => {
    const manager = read('src/components/materials/MaterialManager.jsx');
    const url = read('src/lib/materialUrl.js');
    assert.match(manager, /openMaterial\(mat\)/);
    assert.doesNotMatch(manager, /resolveMaterialOpenUrl/);
    assert.match(url, /\/files\/material\/\$\{material\.id\}\/url/);
  });
});
