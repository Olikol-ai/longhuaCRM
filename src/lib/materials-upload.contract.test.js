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

  it('uses disk storage and 5 GiB materials upload limit', () => {
    const controller = read('apps/api/src/modules/files/secure-files.controller.ts');
    const service = read('apps/api/src/modules/files/secure-files.service.ts');
    const limits = read('apps/api/src/modules/files/material-upload.limits.ts');
    const fe = read('src/lib/materialUpload.js');
    const dto = read('apps/api/src/modules/files/dto/chunked-upload.dto.ts');
    assert.match(controller, /diskStorage/);
    assert.doesNotMatch(controller, /memoryStorage/);
    assert.match(service, /saveFromPath/);
    assert.match(limits, /DEFAULT_MATERIALS_MAX_UPLOAD_BYTES = 5 \* GIB_BYTES/);
    assert.match(limits, /MATERIALS_UPLOAD_MAX_CHUNKS/);
    assert.match(fe, /MATERIALS_MAX_UPLOAD_BYTES = 5 \* 1024 \* 1024 \* 1024/);
    assert.match(dto, /DEFAULT_MATERIALS_MAX_UPLOAD_BYTES/);
  });

  it('exposes upload progress and cancel in MaterialDialog', () => {
    const dialog = read('src/components/materials/MaterialDialog.jsx');
    const http = read('src/api/http.js');
    assert.match(dialog, /uploadProgress/);
    assert.match(dialog, /Отменить загрузку/);
    assert.match(dialog, /phase === 'processing'/);
    assert.match(http, /uploadWithXhr|XMLHttpRequest/);
    assert.match(http, /onProgress/);
    assert.match(http, /phase: 'processing'/);
    assert.match(http, /phase: 'uploading'/);
    assert.match(http, /phase: 'success'/);
    assert.match(http, /phase: 'error'/);
  });

  it('uses chunked upload under Cloudflare body + duration limits', () => {
    const http = read('src/api/http.js');
    const controller = read('apps/api/src/modules/files/secure-files.controller.ts');
    const chunked = read('apps/api/src/modules/files/chunked-upload.service.ts');
    const limits = read('apps/api/src/modules/files/material-upload.limits.ts');
    assert.match(http, /MATERIALS_UPLOAD_CHUNK_THRESHOLD_BYTES/);
    assert.match(http, /MATERIALS_UPLOAD_CHUNK_BYTES = 4 \* 1024 \* 1024/);
    assert.match(limits, /MATERIALS_UPLOAD_CHUNK_BYTES = 4 \* 1024 \* 1024/);
    assert.match(http, /\/files\/upload\/init/);
    assert.match(http, /\/files\/upload\/chunk/);
    assert.match(http, /\/files\/upload\/complete/);
    assert.match(controller, /upload\/init/);
    assert.match(controller, /upload\/chunk/);
    assert.match(controller, /upload\/complete/);
    // Raised per-route throttle (not SkipThrottle) — chunks need headroom, abuse still capped.
    assert.match(controller, /@Throttle\(\{\s*default:\s*\{\s*limit:\s*600/);
    assert.doesNotMatch(
      controller,
      /@SkipThrottle\(\)\s*\n\s*@Post\('upload/,
    );
    assert.match(chunked, /MATERIALS_UPLOAD_CHUNK_BYTES/);
    assert.match(chunked, /getUploadTempRoot/);
    assert.match(chunked, /purgeOrphanMulterTemps/);
  });

  it('MaterialDialog uploads before metadata update (replace keeps old until success)', () => {
    const dialog = read('src/components/materials/MaterialDialog.jsx');
    // Edit path: uploadSelectedFile() then materials.update — never flips URL first.
    assert.match(dialog, /Object\.assign\(payload, await uploadSelectedFile\(\)\)/);
    assert.match(dialog, /await api\.materials\.update\(material\.id, payload\)/);
    assert.match(dialog, /getErrorMessage/);
  });

  it('plays audio via AuthenticatedAudio preview', () => {
    const preview = read('src/components/materials/MaterialMediaPreview.jsx');
    const manager = read('src/components/materials/MaterialManager.jsx');
    assert.match(preview, /AuthenticatedAudio/);
    assert.match(manager, /MaterialMediaPreview/);
    assert.match(manager, /isInAppMediaMaterial/);
  });
});
