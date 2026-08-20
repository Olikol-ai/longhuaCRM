import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyUserStateToChat,
  isChatArchived,
  normalizeUserState,
  patchChatInGroups,
  sortChatsForList,
} from './prefs.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('chat prefs server SSOT (frontend)', () => {
  it('sorts pinned first without localStorage lists', () => {
    const rows = sortChatsForList([
      { id: 'a', userState: { pinned: false }, updatedAt: '2026-08-15T12:00:00Z' },
      { id: 'b', userState: { pinned: true }, updatedAt: '2026-08-15T11:00:00Z' },
    ]);
    assert.equal(rows[0].id, 'b');
  });

  it('patchChatInGroups updates only target chat userState', () => {
    const groups = {
      subject: [
        { id: 'x', title: 'EN', userState: { archived: false } },
        { id: 'y', title: 'CN', userState: { archived: false } },
      ],
    };
    const next = patchChatInGroups(groups, 'x', { archived: true });
    assert.equal(isChatArchived(next.subject[0]), true);
    assert.equal(isChatArchived(next.subject[1]), false);
  });

  it('applyUserStateToChat normalizes aliases', () => {
    const chat = applyUserStateToChat(
      { id: '1' },
      { archived: true, pinned: false, muted: true, favorite: false },
    );
    assert.equal(chat.archived, true);
    assert.equal(chat.muted, true);
    assert.deepEqual(normalizeUserState(chat).archived, true);
  });

  it('Chats page wires socket + archive API', () => {
    const src = fs.readFileSync(path.join(root, 'pages/Chats.jsx'), 'utf8');
    assert.match(src, /chat\.member_prefs/);
    assert.match(src, /archiveChat/);
    assert.match(src, /unarchiveChat/);
    assert.match(src, /socket\.reconnect/);
    assert.match(src, /clearLegacyLocalChatPrefs/);
  });
});
