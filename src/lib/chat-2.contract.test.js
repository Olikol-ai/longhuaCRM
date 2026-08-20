import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectReactions, isReactionBody, REACTION_SET } from './chat/reactions.js';
import { formatDateSeparator, sameCalendarDay } from './chat/dates.js';
import { previewFromMessage } from './chat/preview.js';
import { EMOJI_CATEGORIES } from './chat/emoji.js';
import { listStickerPacks, stickerToFile } from './chat/stickers.js';
import { localGifProvider } from './chat/gifs.js';
import { splitLinks } from './chat/links.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function walkJsx(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkJsx(full, acc);
    else if (/\.(jsx|js)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

describe('Chat 2.0 module', () => {
  it('keeps three-pane desktop shell and mobile messenger UX', () => {
    const page = read('src/pages/Chats.jsx');
    // Collapsible right aside: 2-col or 3-col grid; conversation always minmax(0,1fr).
    assert.match(page, /showDesktopAside/);
    assert.match(page, /minmax\(0,1fr\)/);
    assert.match(page, /data-testid="chat-2-shell"/);
    assert.match(page, /mobilePane/);
    assert.match(page, /backToChatList/);
    assert.match(page, /enableSwipeBack/);
    assert.match(page, /Fab/);
    assert.match(page, /from '@\/design-system'/);
    assert.doesNotMatch(page, /from '@\/components\/ui\/sheet'/);
    assert.doesNotMatch(page, /localStorage.*messages/);
  });

  it('does not change persistence or socket contracts', () => {
    const page = read('src/pages/Chats.jsx');
    assert.match(page, /message\.created/);
    assert.match(page, /chat\.request\.created/);
    assert.match(page, /chatsApi\.messages/);
    assert.match(page, /normalizeMessage/);
    assert.match(page, /messagesByChat/);
    assert.match(page, /loadHistory/);
    assert.match(page, /before:\s*oldest\.id/);
  });

  it('composer still persists via HTTP', () => {
    const composer = read('src/components/chats/ChatComposer.jsx');
    assert.match(composer, /chatsApi\.sendMessage/);
    assert.match(composer, /onMessageCreated\(message\)/);
    assert.match(composer, /replyToMessageId/);
    assert.match(composer, /from '@\/design-system'/);
  });

  it('message pane keeps authenticated attachments and back control', () => {
    const pane = read('src/components/chats/ChatMessagePane.jsx');
    assert.match(pane, /chatAttachmentSrc/);
    assert.match(pane, /ArrowLeft/);
    assert.doesNotMatch(pane, /createObjectURL/);
    assert.doesNotMatch(pane, /from '@\/components\/ui\/button'/);
    assert.doesNotMatch(pane, /from '@\/components\/ui\/scroll-area'/);
  });

  it('FindInterlocutor still sends DM requests', () => {
    const dialog = read('src/components/chats/FindInterlocutorDialog.jsx');
    assert.match(dialog, /Отправить запрос/);
    assert.match(dialog, /createDmRequest/);
    assert.match(dialog, /selectedId/);
    assert.match(dialog, /Запрос на переписку отправлен/);
    assert.match(dialog, /userFacingError/);
    assert.doesNotMatch(dialog, /createDirect/);
    assert.doesNotMatch(dialog, /disabled=\{!canRequest/);
  });

  it('ships a real sticker pack and emoji taxonomy', () => {
    const packs = listStickerPacks();
    assert.equal(packs[0].id, 'longhua-academy');
    assert.ok(packs[0].stickers.length >= 8);
    const file = stickerToFile(packs[0].stickers[0]);
    assert.match(file.name, /^sticker-/);
    assert.ok(EMOJI_CATEGORIES.length >= 6);
    assert.ok(REACTION_SET.includes('👍'));
    assert.ok(REACTION_SET.includes('❤️'));
  });

  it('GIF provider is a real local pack, not an empty stub', async () => {
    const trending = await localGifProvider.trending();
    assert.ok(trending.length >= 4);
    const file = localGifProvider.toFile(trending[0]);
    assert.match(file.name, /^gif-/);
  });

  it('aggregates emoji replies as reactions', () => {
    assert.equal(isReactionBody('🔥'), true);
    assert.equal(isReactionBody('hello'), false);
    const map = collectReactions(
      [
        { id: '1', body: 'hi' },
        { id: '2', body: '👍', replyToMessageId: '1', senderUserId: 'me' },
        { id: '3', body: '👍', replyToMessageId: '1', senderUserId: 'you' },
      ],
      'me',
    );
    const rows = [...map.get('1').values()];
    assert.equal(rows[0].count, 2);
    assert.equal(rows[0].mine, true);
  });

  it('formats date separators and link previews', () => {
    const now = new Date();
    assert.equal(formatDateSeparator(now), 'Сегодня');
    assert.equal(sameCalendarDay(now, now), true);
    assert.equal(previewFromMessage({ type: 'homework', body: 'HSK' }).icon, 'homework');
    const parts = splitLinks('см. https://longhua.example/a и текст');
    assert.ok(parts.some((part) => part.type === 'link'));
  });

  it('new chat UI does not import legacy primitives or slate utilities', () => {
    const files = walkJsx(join(root, 'src/components/chats'));
    files.push(join(root, 'src/pages/Chats.jsx'));
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      assert.doesNotMatch(src, /from '@\/components\/ui\/button'/, file);
      assert.doesNotMatch(src, /from '@\/components\/ui\/input'/, file);
      assert.doesNotMatch(src, /from '@\/components\/ui\/scroll-area'/, file);
      assert.doesNotMatch(src, /from '@\/components\/ui\/sheet'/, file);
      assert.doesNotMatch(src, /slate-\d+/, file);
    }
  });
});
