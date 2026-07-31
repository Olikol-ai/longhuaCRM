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
    assert.match(service, /findExistingUpload/);
    assert.match(service, /logMissingFile/);
    assert.match(service, /warnOrphanMaterialFiles/);
    assert.match(service, /OnModuleInit/);
  });

  it('pins uploads via UPLOADS_DIR in docker prod', () => {
    const compose = read('docker-compose.prod.yml');
    assert.match(compose, /UPLOADS_DIR:\s*\/app\/uploads/);
  });

  it('uses shared uploads-root for materials storage', () => {
    const service = read('apps/api/src/modules/files/secure-files.service.ts');
    const uploads = read('apps/api/src/common/storage/uploads-root.ts');
    assert.match(service, /getUploadsRoot/);
    assert.match(uploads, /UPLOADS_DIR/);
    assert.match(uploads, /mkdirSync\(absolute, \{ recursive: true \}\)/);
  });
});
