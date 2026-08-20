import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  browseMaterials,
  compareMaterialTitles,
  materialMatchesSearch,
  resolveMaterialBrowseKind,
} from './materialBrowse.js';

describe('materialBrowse', () => {
  it('sorts titles case-insensitively with numeric awareness', () => {
    const titles = ['HSK 10', 'hsk 2', 'HSK 1', 'Аудио'];
    const sorted = [...titles].sort(compareMaterialTitles);
    assert.deepEqual(sorted, ['Аудио', 'HSK 1', 'hsk 2', 'HSK 10']);
  });

  it('searches title, filename, block and description', () => {
    const mat = {
      title: 'Listening drill',
      original_filename: 'hsk2-audio.mp3',
      description: '___BLOCK___:HSK 2\nПрактика аудирования',
      file_type: 'audio',
    };
    assert.equal(materialMatchesSearch(mat, 'HSK 2'), true);
    assert.equal(materialMatchesSearch(mat, 'hsk2-audio'), true);
    assert.equal(materialMatchesSearch(mat, 'аудирования'), true);
    assert.equal(materialMatchesSearch(mat, 'missing'), false);
  });

  it('filters by derived type and sorts newest first by default', () => {
    const rows = [
      {
        id: '1',
        title: 'Old PDF',
        file_type: 'pdf',
        created_date: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        title: 'New audio',
        file_type: 'audio',
        original_filename: 'clip.mp3',
        created_date: '2026-08-01T00:00:00.000Z',
      },
      {
        id: '3',
        title: 'Photo',
        file_type: 'other',
        original_filename: 'pic.png',
        mime_type: 'image/png',
        created_date: '2026-07-01T00:00:00.000Z',
      },
    ];
    assert.equal(resolveMaterialBrowseKind(rows[2]), 'image');
    const filtered = browseMaterials(rows, { typeFilter: 'pdf', sort: 'newest' });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, '1');
    const newest = browseMaterials(rows, { sort: 'newest' });
    assert.deepEqual(newest.map((r) => r.id), ['2', '3', '1']);
  });
});
