import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

/**
 * Regression: filter labels like «Непрочитанные» must never be intentionally clipped.
 */
describe('chat desktop filter/info tab layout', () => {
  it('sidebar keeps full filter labels and wrap layout', () => {
    const sidebar = read('components/chats/ChatSidebar.jsx');
    for (const label of ['Активные', 'Непрочитанные', 'Избранное', 'Архив']) {
      assert.match(sidebar, new RegExp(label));
    }
    assert.match(sidebar, /lh-chat-filter-tabs__btn/);
    const filterBlock = sidebar.slice(
      sidebar.indexOf('lh-chat-filter-tabs'),
      sidebar.indexOf('Запросы'),
    );
    assert.doesNotMatch(filterBlock, /truncate/);
    assert.doesNotMatch(sidebar, /overflow-x-auto/);
    assert.doesNotMatch(filterBlock, /text-\[9px\]|text-\[10px\]/);
  });

  it('CSS filter pills do not shrink or clip text', () => {
    const css = read('index.css');
    assert.match(css, /\.lh-chat-filter-tabs__btn/);
    assert.match(css, /flex:\s*0\s+0\s+auto/);
    assert.match(css, /white-space:\s*nowrap/);
    assert.match(css, /overflow:\s*visible/);
    assert.doesNotMatch(css, /text-overflow:\s*ellipsis/);
  });

  it('info panel tabs wrap with readable labels (no 10px / no 6-col squeeze)', () => {
    const info = read('components/chats/ChatInfoPanel.jsx');
    assert.match(info, /Информация/);
    assert.match(info, /Участники/);
    assert.match(info, /Материалы/);
    assert.match(info, /Закрепления/);
    assert.doesNotMatch(info, /text-\[10px\]/);
    assert.doesNotMatch(info, /grid-cols-6/);
    const infoTabsBlock = info.slice(
      info.indexOf('lh-chat-info-tabs'),
      info.indexOf('lh-chat-info-tabs__btn') > -1
        ? info.indexOf('onClose ?')
        : info.length,
    );
    assert.doesNotMatch(infoTabsBlock, /truncate/);
  });

  it('desktop grid keeps usable sidebar min width at 1280-class layouts', () => {
    const page = read('pages/Chats.jsx');
    assert.match(page, /minmax\(17rem/);
    assert.match(page, /minmax\(0,1fr\)/);
    assert.doesNotMatch(page, /minmax\(15rem/);
  });
});
