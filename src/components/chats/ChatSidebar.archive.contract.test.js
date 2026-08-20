import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sidebar = fs.readFileSync(path.join(root, 'components/chats/ChatSidebar.jsx'), 'utf8');
const menu = fs.readFileSync(path.join(root, 'components/chats/ChatListMenu.jsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api/chats.api.js'), 'utf8');

describe('desktop chat archive actions (contract)', () => {
  it('TEST7: hover archive control isolates click from openChat', () => {
    assert.match(sidebar, /function stopRowOpen/);
    assert.match(sidebar, /stopPropagation/);
    assert.match(sidebar, /md:group-hover:pointer-events-auto/);
    assert.match(sidebar, /label=\{archiveLabel\}/);
    assert.match(sidebar, /onClick=\{runArchive\}/);
    assert.match(sidebar, /onPointerDown=\{stopRowOpen\}/);
    // Actions sit above the row (z-[2]), not behind it.
    assert.match(sidebar, /z-\[2\]/);
  });

  it('TEST8: archive button is a real button with localized accessible label', () => {
    assert.match(sidebar, /Переместить в архив/);
    assert.match(sidebar, /Вернуть из архива/);
    assert.match(sidebar, /type="button"/);
    assert.match(sidebar, /IconButton/);
  });

  it('TEST9: right-click menu wires archive action (not openChat)', () => {
    assert.match(menu, /Переместить в архив/);
    assert.match(menu, /role="menuitem"/);
    assert.match(menu, /stopPropagation/);
    assert.match(menu, /onAction\?\.\(item\.id\)/);
  });

  it('TEST10/11/12: Active vs Archive filter uses server userState', () => {
    assert.match(sidebar, /filter === 'archive'/);
    assert.match(sidebar, /isChatArchived/);
    assert.match(sidebar, /onArchive=\{\(row\) => runPref\(row, 'archive'\)\}/);
  });

  it('API client posts archive/unarchive (no local-only fallback)', () => {
    assert.match(api, /\/chats\/\$\{chatId\}\/archive/);
    assert.match(api, /\/chats\/\$\{chatId\}\/unarchive/);
    assert.match(api, /method: 'POST'/);
  });
});
