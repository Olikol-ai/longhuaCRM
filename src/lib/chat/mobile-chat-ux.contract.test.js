import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChatTitle, resolveChatPeerUser } from './titles.js';
import { resolveReactionAction } from './reactions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('mobile chat messenger UX contracts', () => {
  it('DM title resolves peer name, not Личный чат', () => {
    const title = resolveChatTitle(
      {
        kind: 'direct',
        title: '',
        peer: { firstName: 'Иван', lastName: 'Иванов' },
      },
      { currentUserId: 'me' },
    );
    assert.equal(title, 'Иванов Иван');
    assert.notEqual(title, 'Личный чат');
  });

  it('group title stays stored name', () => {
    assert.equal(
      resolveChatTitle({ kind: 'group', title: 'HSK 3' }, { currentUserId: 'me' }),
      'HSK 3',
    );
  });

  it('peer resolver prefers payload peer', () => {
    const peer = resolveChatPeerUser(
      { kind: 'direct', peer: { id: 'p1', firstName: 'Анна' } },
      { currentUserId: 'me' },
    );
    assert.equal(peer.id, 'p1');
  });

  it('mobile immersive hides CRM header and uses 100dvh shell', () => {
    const css = read('index.css');
    const page = read('pages/Chats.jsx');
    const layout = read('Layout.jsx');
    assert.match(css, /data-lh-mobile-chat/);
    assert.match(css, /100dvh/);
    assert.match(css, /\.lh-crm-mobile-header/);
    assert.match(page, /data-lh-mobile-chat/);
    assert.match(layout, /lh-crm-mobile-header/);
  });

  it('long-press layer disables text selection', () => {
    const css = read('index.css');
    const bubble = read('components/chats/ChatMessageBubble.jsx');
    assert.match(css, /-webkit-user-select:\s*none/);
    assert.match(css, /touch-action:\s*manipulation/);
    assert.match(bubble, /removeAllRanges/);
    assert.match(bubble, /onTouchCancel/);
  });

  it('mobile context menu is bottom sheet without auto-focus', () => {
    const menu = read('components/chats/ChatContextMenu.jsx');
    assert.match(menu, /justify-end/);
    assert.match(menu, /tabIndex=\{-1\}/);
    assert.match(menu, /removeAllRanges|blur/);
  });

  it('one user one reaction: replace and toggle remove', () => {
    const messages = [
      {
        id: 'r1',
        replyToMessageId: 'm1',
        senderUserId: 'u1',
        body: '😀',
      },
    ];
    assert.deepEqual(
      resolveReactionAction({
        messages,
        parentId: 'm1',
        emoji: '❤️',
        currentUserId: 'u1',
      }),
      { type: 'replace', removeId: 'r1', emoji: '❤️' },
    );
    assert.deepEqual(
      resolveReactionAction({
        messages,
        parentId: 'm1',
        emoji: '😀',
        currentUserId: 'u1',
      }),
      { type: 'remove', messageId: 'r1' },
    );
  });

  it('desktop back button not forced; mobile immersive uses onBack', () => {
    const page = read('pages/Chats.jsx');
    assert.match(page, /onBack=\{!isLgUp \? backToChatList : undefined\}/);
  });

  it('API enriches direct peers for title SSOT', () => {
    const svc = read('../apps/api/src/modules/chats/services/chats.service.ts');
    assert.match(svc, /attachDirectPeers/);
    assert.match(svc, /composeDisplayName/);
  });
});
