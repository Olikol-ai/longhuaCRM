import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('materials upload integrity', () => {
  it('allows school audio extensions on backend and frontend', () => {
    const limits = read('apps/api/src/modules/files/material-upload.limits.ts');
    const dialog = read('src/components/materials/MaterialDialog.jsx');
    const meta = read('src/lib/materialMeta.js');
    for (const ext of ['.mp3', '.wav', '.m4a', '.aac', '.ogg']) {
      assert.match(limits, new RegExp(ext.replace('.', '\\.')));
    }
    assert.match(dialog, /MATERIALS_FILE_ACCEPT/);
    assert.match(meta, /audio/);
    assert.match(meta, /isAudioMaterial/);
  });

  it('uses disk storage and configurable large upload limit', () => {
    const controller = read('apps/api/src/modules/files/secure-files.controller.ts');
    const service = read('apps/api/src/modules/files/secure-files.service.ts');
    const limits = read('apps/api/src/modules/files/material-upload.limits.ts');
    assert.match(controller, /diskStorage/);
    assert.doesNotMatch(controller, /memoryStorage/);
    assert.match(service, /saveFromPath/);
    assert.match(limits, /MATERIALS_MAX_UPLOAD_BYTES/);
    assert.match(limits, /DEFAULT_MATERIALS_MAX_UPLOAD_BYTES/);
  });

  it('exposes upload progress and cancel in MaterialDialog', () => {
    const dialog = read('src/components/materials/MaterialDialog.jsx');
    const http = read('src/api/http.js');
    assert.match(dialog, /uploadProgress/);
    assert.match(dialog, /Отменить загрузку/);
    assert.match(http, /uploadWithXhr|XMLHttpRequest/);
    assert.match(http, /onProgress/);
  });

  it('plays audio via AuthenticatedAudio preview', () => {
    const preview = read('src/components/materials/MaterialMediaPreview.jsx');
    const manager = read('src/components/materials/MaterialManager.jsx');
    assert.match(preview, /AuthenticatedAudio/);
    assert.match(manager, /MaterialMediaPreview/);
    assert.match(manager, /isInAppMediaMaterial/);
  });
});
