import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  packMaterialDescription,
  publicMaterialDescription,
  unpackMaterialDescription,
  detectFileType,
  detectLinkType,
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

  it('detects file and link types', () => {
    assert.equal(detectFileType('lesson.pdf'), 'pdf');
    assert.equal(detectFileType('slides.pptx'), 'pptx');
    assert.equal(detectLinkType('https://youtu.be/abc'), 'video');
    assert.equal(detectLinkType('https://example.com/x'), 'link');
  });
});
