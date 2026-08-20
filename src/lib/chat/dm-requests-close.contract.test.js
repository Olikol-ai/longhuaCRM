import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('DmRequestsPanel close button contract', () => {
  it('uses Design System IconButton with accessible close label', () => {
    const src = read('components/chats/DmRequestsPanel.jsx');
    assert.match(src, /IconButton/);
    assert.match(src, /label="Закрыть"/);
    assert.match(src, /data-testid="dm-requests-close"/);
    assert.match(src, /data-testid="dm-requests-panel"/);
    assert.match(src, /onClick=\{onClose\}/);
    assert.match(src, /<X\s*\/>/);
    // Close stays in document flow header — not absolute negative offset.
    assert.doesNotMatch(src, /right:\s*-\d|right-\[[-]|\-mr-|absolute right-/);
  });

  it('chat sheets hide duplicate Sheet close when panel has its own', () => {
    const chats = read('pages/Chats.jsx');
    assert.match(chats, /showClose=\{false\}/);
  });

  it('overlay close button constrains icon inside square hit target', () => {
    const dialog = read('components/ui/dialog.jsx');
    assert.match(dialog, /overlayCloseButtonClassName/);
    assert.match(dialog, /overflow-hidden/);
    assert.match(dialog, /\[&_svg\]:size-4/);
    assert.match(dialog, /size-11/);
    assert.match(dialog, /md:size-9/);
    const sheet = read('components/ui/sheet.jsx');
    assert.match(sheet, /overlayCloseButtonClassName/);
    assert.match(sheet, /showClose/);
  });
});
