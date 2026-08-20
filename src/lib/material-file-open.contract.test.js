import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('material file open integrity', () => {
  it('checks disk existence before issuing signed material URLs', () => {
    const service = read('apps/api/src/modules/files/secure-files.service.ts');
    assert.match(service, /createSignedFileUrl/);
    assert.match(service, /storage\.resolveExisting|storage\.exists|storage\.openReadStream/);
    assert.match(service, /warnOrphanMaterialFiles/);
    assert.match(service, /OnModuleInit/);
    assert.match(service, /StorageService/);
  });

  it('pins uploads via UPLOADS_DIR on permanent HDD path', () => {
    const compose = read('docker-compose.prod.yml');
    assert.match(compose, /UPLOADS_DIR:\s*\/mnt\/storage\/longhua-storage/);
    assert.match(compose, /longhua-storage/);
  });

  it('exposes a global StorageService module', () => {
    const mod = read('apps/api/src/common/storage/storage.module.ts');
    const svc = read('apps/api/src/common/storage/storage.service.ts');
    const app = read('apps/api/src/app.module.ts');
    assert.match(mod, /StorageModule/);
    assert.match(svc, /class StorageService/);
    assert.match(app, /StorageModule/);
  });

  it('does not sign or proxy external Canva/http material URLs', () => {
    const service = read('apps/api/src/modules/files/secure-files.service.ts');
    const util = read('apps/api/src/modules/files/material-open-url.util.ts');
    assert.match(util, /external-canva/);
    assert.match(util, /isExternalMaterialUrl/);
    assert.match(service, /classifyMaterialFileUrl/);
    assert.match(service, /external-canva/);
    assert.match(service, /isExternalMaterialUrl/);
    assert.doesNotMatch(service, /\/api\/canva/);
  });

  it('uses shared uploads-root without cwd fallbacks', () => {
    const uploads = read('apps/api/src/common/storage/uploads-root.ts');
    assert.match(uploads, /UPLOADS_DIR/);
    assert.match(uploads, /UploadsRootNotConfiguredError/);
    assert.doesNotMatch(uploads, /resolve\(process\.cwd\(/);
    assert.doesNotMatch(uploads, /__dirname/);
  });
});
