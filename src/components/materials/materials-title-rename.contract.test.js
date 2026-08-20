import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveMaterialDisplayTitle } from '../../lib/materialMeta.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('materials title + folder rename regression', () => {
  it('MaterialTable always renders a visible title with tooltip', () => {
    const table = read('components/materials/MaterialTable.jsx');
    assert.match(table, /resolveMaterialDisplayTitle/);
    assert.match(table, /data-testid=\{`material-title-\$\{mat\.id\}`\}/);
    assert.match(table, /line-clamp-2/);
    assert.match(table, /title=\{displayTitle\}/);
    const desktop = table.slice(table.indexOf('hidden lg:block'), table.indexOf('</table>'));
    assert.doesNotMatch(desktop, /\{mat\.title\}/);
  });

  it('long titles resolve without collapsing to empty', () => {
    const long =
      'HSK 3 — учебные материалы для корпоративного курса Longhua Chinese School.pdf';
    assert.equal(resolveMaterialDisplayTitle({ title: long }), long);
    assert.ok(resolveMaterialDisplayTitle({ title: long }).length > 40);
  });

  it('folder rename uses existing PATCH endpoint and dialog', () => {
    const tree = read('components/materials/FolderTree.jsx');
    const dialog = read('components/materials/RenameFolderDialog.jsx');
    const api = read('api/materials.api.js');
    assert.match(tree, /folders\.update/);
    assert.match(tree, /Переименовать/);
    assert.match(tree, /Открыть/);
    assert.match(tree, /RenameFolderDialog/);
    assert.match(tree, /onFolderRenamed/);
    assert.match(dialog, /Переименовать папку/);
    assert.match(dialog, /Введите название папки/);
    assert.match(dialog, /onKeyDown/);
    assert.match(api, /createDomainClient\('\/materials\/folders'/);
  });

  it('student materials cards show resolved titles', () => {
    const page = read('pages/StudentLessonMaterials.jsx');
    assert.match(page, /resolveMaterialDisplayTitle/);
    assert.match(page, /data-testid=\{`material-title-\$\{mat\.id\}`\}/);
  });
});
