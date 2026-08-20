import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyMaterialOpenUrl,
  describeMaterialOpen,
  isCanvaMaterial,
  isExternalLinkMaterial,
} from './materialMeta.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const CANVA_URL = 'https://www.canva.com/design/DAGshared/view';

describe('Canva material URL contract', () => {
  it('Teacher A and Teacher B payloads classify to the same Canva URL', () => {
    const teacherA = {
      id: 'aaaa',
      file_type: 'canva',
      file_url: CANVA_URL,
    };
    const teacherB = {
      id: 'aaaa',
      file_type: 'pptx',
      fileUrl: CANVA_URL,
      access_sources: [{ type: 'personal' }],
    };

    const a = classifyMaterialOpenUrl(teacherA.file_url);
    const b = classifyMaterialOpenUrl(teacherB.fileUrl);
    assert.equal(a.openUrl, CANVA_URL);
    assert.equal(b.openUrl, CANVA_URL);
    assert.equal(a.openUrl, b.openUrl);
    assert.equal(a.kind, 'external-canva');
    assert.equal(b.kind, 'external-canva');
    assert.equal(isCanvaMaterial(teacherA), true);
    assert.equal(isCanvaMaterial(teacherB), true);
    assert.equal(isExternalLinkMaterial(teacherB), true);
    assert.doesNotMatch(a.openUrl, /\/api\/files\/signed\//);
  });

  it('does not treat PDF/Word/Excel/image/video uploads as Canva', () => {
    const pdf = {
      id: 'pdf-1',
      file_type: 'pdf',
      file_url: '/uploads/materials/book.pdf',
    };
    const classified = classifyMaterialOpenUrl(pdf.file_url);
    assert.equal(classified.kind, 'local-upload');
    assert.equal(isCanvaMaterial(pdf), false);
    assert.equal(describeMaterialOpen(pdf).urlType, 'local-upload');
  });

  it('frontend open path skips signed-file for Canva and shows Canva access copy', () => {
    const urlLib = read('src/lib/materialUrl.js');
    const meta = read('src/lib/materialMeta.js');
    assert.match(urlLib, /classifyMaterialOpenUrl/);
    assert.match(urlLib, /external-canva/);
    assert.match(urlLib, /CANVA_ACCESS_NOTICE/);
    assert.match(urlLib, /notifyCanvaAccessModel/);
    assert.match(meta, /Canva не предоставила доступ к этому материалу/);
    assert.doesNotMatch(urlLib, /\/api\/canva/);
  });

  it('backend returns stored Canva URL instead of signing it', () => {
    const service = read('apps/api/src/modules/files/secure-files.service.ts');
    assert.match(service, /external-canva/);
    assert.match(service, /classified\.openUrl/);
    assert.match(service, /urlHostname=/);
    assert.match(service, /acl=/);
  });
});
