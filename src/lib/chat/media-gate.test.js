import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canRevealChatMedia, lockedMediaLabel } from './media-gate.js';
import { resolveReactionAction } from './reactions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('chat media gate (E2EE)', () => {
  it('blocks direct media until vault unlock', () => {
    assert.equal(canRevealChatMedia({ chatKind: 'group', e2eeReady: false }), true);
    assert.equal(canRevealChatMedia({ chatKind: 'direct', e2eeReady: false }), false);
    assert.equal(canRevealChatMedia({ chatKind: 'direct', e2eeReady: true }), true);
    assert.match(lockedMediaLabel('image'), /Зашифрованное/);
  });

  it('attachment / lightbox / blob hook never render plaintext before unlock', () => {
    const attachment = read('components/chats/ChatAttachment.jsx');
    const pane = read('components/chats/ChatMessagePane.jsx');
    const hook = read('lib/use-chat-attachment-object-url.js');
    assert.match(attachment, /mediaLocked/);
    assert.match(attachment, /data-media-locked/);
    assert.match(attachment, /chatAttachmentSrc/);
    assert.match(attachment, /mediaLocked \? null : chatAttachmentSrc/);
    assert.match(attachment, /enabled:\s*Boolean\(isVideo && !mediaLocked/);
    assert.doesNotMatch(attachment, /blur-|opacity-0|display:\s*none/);
    assert.match(pane, /canRevealChatMedia/);
    assert.match(pane, /mediaLocked/);
    assert.match(pane, /if \(mediaLocked\) return \[\]/);
    assert.match(pane, /open=\{lightboxOpen && !mediaLocked\}/);
    assert.match(pane, /setPlaintextById\(\{\}\)/);
    assert.match(hook, /enabled/);
    assert.match(hook, /if \(!attachmentId \|\| !enabled\)/);
    assert.match(hook, /revokeObjectURL/);
  });
});

describe('one reaction per user', () => {
  const messages = [
    { id: 'm1', body: 'hi' },
    { id: 'r1', body: '👍', replyToMessageId: 'm1', senderUserId: 'me' },
  ];

  it('adds when user has none', () => {
    assert.deepEqual(
      resolveReactionAction({
        messages: [{ id: 'm1', body: 'hi' }],
        parentId: 'm1',
        emoji: '❤️',
        currentUserId: 'me',
      }),
      { type: 'add', emoji: '❤️' },
    );
  });

  it('removes when same emoji is pressed again', () => {
    assert.deepEqual(
      resolveReactionAction({
        messages,
        parentId: 'm1',
        emoji: '👍',
        currentUserId: 'me',
      }),
      { type: 'remove', messageId: 'r1' },
    );
  });

  it('replaces when a different emoji is chosen', () => {
    assert.deepEqual(
      resolveReactionAction({
        messages,
        parentId: 'm1',
        emoji: '❤️',
        currentUserId: 'me',
      }),
      { type: 'replace', removeId: 'r1', emoji: '❤️' },
    );
  });

  it('message pane uses resolveReactionAction and portals menus', () => {
    const pane = read('components/chats/ChatMessagePane.jsx');
    const menu = read('components/chats/ChatContextMenu.jsx');
    const picker = read('components/chats/ChatEmojiPicker.jsx');
    const voice = read('components/chats/VoicePlayer.jsx');
    const bubble = read('components/chats/ChatMessageBubble.jsx');
    assert.match(pane, /resolveReactionAction/);
    assert.match(pane, /createPortal/);
    assert.match(pane, /chat-reaction-sheet/);
    assert.match(menu, /createPortal/);
    assert.match(menu, /document\.body/);
    assert.match(picker, /data-emoji-scroll/);
    assert.match(picker, /overflow-y-auto/);
    assert.match(voice, /lh-chat-voice--standalone|standalone/);
    assert.match(bubble, /voiceOnly|lh-chat-bubble--voice/);
  });
});
