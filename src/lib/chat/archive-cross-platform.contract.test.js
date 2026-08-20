import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isChatArchived,
  LEGACY_CHAT_PREFS_KEY,
  patchChatInGroups,
} from './prefs.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const apiRoot = path.resolve(root, '../apps/api/src/modules/chats');

describe('archive cross-platform SSOT', () => {
  it('Active/Archive filters use isChatArchived (server userState)', () => {
    const sidebar = fs.readFileSync(path.join(root, 'components/chats/ChatSidebar.jsx'), 'utf8');
    assert.match(sidebar, /isChatArchived/);
    assert.match(sidebar, /filter === 'archive'/);
    assert.doesNotMatch(sidebar, /localStorage.*archiv/i);
  });

  it('desktop hover archive stops row open + uses type=button', () => {
    const sidebar = fs.readFileSync(path.join(root, 'components/chats/ChatSidebar.jsx'), 'utf8');
    assert.match(sidebar, /stopRowOpen/);
    assert.match(sidebar, /onArchive/);
    assert.match(sidebar, /aria-label=\{archiveLabel\}/);
    assert.match(sidebar, /md:group-hover:pointer-events-auto/);
  });

  it('desktop context menu archive action is wired', () => {
    const menu = fs.readFileSync(path.join(root, 'components/chats/ChatListMenu.jsx'), 'utf8');
    assert.match(menu, /Переместить в архив|Вернуть из архива/);
    assert.match(menu, /id: 'archive'/);
  });

  it('mobile and desktop share the same archive mutation path', () => {
    const page = fs.readFileSync(path.join(root, 'pages/Chats.jsx'), 'utf8');
    assert.match(page, /chatsApi\.archiveChat/);
    assert.match(page, /chatsApi\.unarchiveChat/);
    assert.match(page, /onToggleMemberPref/);
    assert.match(page, /chat\.member_prefs/);
    assert.match(page, /socket\.reconnect/);
    assert.match(page, /visibilitychange/);
  });

  it('legacy localStorage prefs key is cleared, never authoritative', () => {
    const prefs = fs.readFileSync(path.join(root, 'lib/chat/prefs.js'), 'utf8');
    assert.equal(LEGACY_CHAT_PREFS_KEY, 'longhua_chat_prefs_v2');
    assert.match(prefs, /clearLegacyLocalChatPrefs/);
    assert.doesNotMatch(prefs, /localStorage\.getItem\(LEGACY_CHAT_PREFS_KEY\)/);
  });

  it('stale client archive cannot outrank server patch', () => {
    const groups = {
      subject: [
        { id: 'math', title: '📚 Математика', userState: { archived: true } },
        { id: 'phys', title: '📚 Физика', userState: { archived: false } },
      ],
    };
    // Server says math is active again (e.g. unarchive on desktop).
    const next = patchChatInGroups(groups, 'math', {
      archived: false,
      archivedAt: null,
    });
    assert.equal(isChatArchived(next.subject[0]), false);
    assert.equal(isChatArchived(next.subject[1]), false);
  });

  it('backend archive SSOT is chat_members.archived_at', () => {
    const svc = fs.readFileSync(path.join(apiRoot, 'services/chats.service.ts'), 'utf8');
    assert.match(svc, /COALESCE\(archived_at/);
    assert.match(svc, /memberRepo\.query/);
    assert.match(svc, /async archiveChat/);
    assert.match(svc, /async unarchiveChat/);
    assert.match(svc, /emitToUser\(actor\.sub, 'chat\.member_prefs'/);
  });

  it('subject entitlement sync must not wipe archived membership', () => {
    const sync = fs.readFileSync(
      path.join(apiRoot, 'services/chat-membership-sync.service.ts'),
      'utf8',
    );
    assert.match(sync, /removeSubjectMembershipUnlessPrefs/);
    assert.match(sync, /hasStickyState|lastReadMessageId/);
    assert.match(sync, /archivedAt/);
  });

  it('API client has one archive/unarchive endpoint for all clients', () => {
    const api = fs.readFileSync(path.join(root, 'api/chats.api.js'), 'utf8');
    assert.match(api, /archiveChat:/);
    assert.match(api, /unarchiveChat:/);
    assert.match(api, /\/chats\/\$\{chatId\}\/archive/);
    assert.match(api, /\/chats\/\$\{chatId\}\/unarchive/);
  });
});
