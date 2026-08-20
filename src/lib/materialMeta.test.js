import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  packMaterialDescription,
  publicMaterialDescription,
  resolveMaterialDisplayTitle,
  unpackMaterialDescription,
  detectFileType,
  detectLinkType,
  isCanvaMaterial,
  isExternalLinkMaterial,
  resolveMaterialTypeKey,
  classifyMaterialOpenUrl,
} from './materialMeta.js';

describe('materialMeta', () => {
  it('packs and unpacks description, notes and block', () => {
    const packed = packMaterialDescription({
      description: 'Для учеников',
      notes: 'Внутренняя заметка',
      blockName: 'Блок 1',
    });
    const unpacked = unpackMaterialDescription(packed);
    assert.equal(unpacked.description, 'Для учеников');
    assert.equal(unpacked.notes, 'Внутренняя заметка');
    assert.equal(unpacked.blockName, 'Блок 1');
    assert.equal(publicMaterialDescription(packed), 'Для учеников');
    assert.ok(!publicMaterialDescription(packed).includes('Внутренняя'));
  });

  it('resolves display title with fallbacks and never blanks when filename exists', () => {
    assert.equal(
      resolveMaterialDisplayTitle({ title: 'Учебник HSK 3.pdf' }),
      'Учебник HSK 3.pdf',
    );
    assert.equal(
      resolveMaterialDisplayTitle({
        title: '',
        original_filename: 'HSK 3 — учебные материалы.pdf',
      }),
      'HSK 3 — учебные материалы.pdf',
    );
    assert.equal(resolveMaterialDisplayTitle({}), 'Без названия');
    assert.equal(
      resolveMaterialDisplayTitle({
        title: '  ',
        name: 'Аудио урок',
      }),
      'Аудио урок',
    );
  });

  it('detects file and link types', () => {
    assert.equal(detectFileType('lesson.pdf'), 'pdf');
    assert.equal(detectFileType('slides.pptx'), 'pptx');
    assert.equal(detectLinkType('https://youtu.be/abc'), 'video');
    assert.equal(detectLinkType('https://example.com/x'), 'link');
    assert.equal(detectLinkType('https://www.canva.com/design/DAGabc/view'), 'canva');
    assert.equal(
      detectLinkType('https://docs.google.com/presentation/d/abc/edit'),
      'link',
    );
  });

  it('treats Canva as an external link even when stored as pptx', () => {
    const canva = {
      id: 'mat-1',
      file_type: 'pptx',
      file_url: 'https://www.canva.com/design/DAGabc/view',
    };
    assert.equal(isCanvaMaterial(canva), true);
    assert.equal(isExternalLinkMaterial(canva), true);
    assert.equal(resolveMaterialTypeKey(canva), 'canva');
    assert.equal(classifyMaterialOpenUrl(canva.file_url).kind, 'external-canva');
    assert.equal(
      classifyMaterialOpenUrl(canva.file_url).openUrl,
      canva.file_url,
    );
  });
});
