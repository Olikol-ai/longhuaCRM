import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('desktop chat UX messenger contracts', () => {
  it('layout collapses right aside and keeps conversation minmax', () => {
    const page = read('pages/Chats.jsx');
    assert.match(page, /showDesktopAside/);
    assert.match(page, /data-aside=/);
    assert.match(page, /minmax\(0,1fr\)/);
    assert.match(page, /closeDesktopAside|onClose=\{closeDesktopAside\}/);
  });

  it('chat list: Active/Archive filters + hover more without openChat', () => {
    const sidebar = read('components/chats/ChatSidebar.jsx');
    assert.match(sidebar, /Активные/);
    assert.match(sidebar, /Архив/);
    assert.match(sidebar, /function stopRowOpen/);
    assert.match(sidebar, /MoreVertical/);
    assert.match(sidebar, /label="Ещё"/);
  });

  it('context menu includes mark unread + prefs', () => {
    const menu = read('components/chats/ChatListMenu.jsx');
    assert.match(menu, /Пометить непрочитанным/);
    assert.match(menu, /mark_unread/);
    assert.match(menu, /Переместить в архив/);
    assert.match(menu, /stopPropagation/);
  });

  it('mark unread wired through API + Chats page', () => {
    const api = read('api/chats.api.js');
    const page = read('pages/Chats.jsx');
    assert.match(api, /markUnread/);
    assert.match(api, /\/chats\/\$\{chatId\}\/unread/);
    assert.match(page, /mark_unread/);
    assert.match(page, /chatsApi\.markUnread/);
  });

  it('info panel and requests use DS close IconButton', () => {
    const info = read('components/chats/ChatInfoPanel.jsx');
    const req = read('components/chats/DmRequestsPanel.jsx');
    assert.match(info, /onClose/);
    assert.match(info, /IconButton/);
    assert.match(info, /label="Закрыть"/);
    assert.match(req, /requestStatusLabel|Ожидает ответа/);
    assert.match(req, /label="Закрыть"/);
  });

  it('filter and info tabs wrap without clipping labels or horizontal scroll', () => {
    const sidebar = read('components/chats/ChatSidebar.jsx');
    const info = read('components/chats/ChatInfoPanel.jsx');
    const css = read('index.css');
    const page = read('pages/Chats.jsx');

    assert.match(sidebar, /Непрочитанные/);
    assert.match(sidebar, /lh-chat-filter-tabs/);
    assert.match(sidebar, /lh-chat-filter-tabs__btn/);
    const filterBlock = sidebar.slice(
      sidebar.indexOf('lh-chat-filter-tabs'),
      sidebar.indexOf('Запросы'),
    );
    assert.doesNotMatch(filterBlock, /truncate/);
    assert.doesNotMatch(sidebar, /overflow-x-auto/);
    assert.doesNotMatch(sidebar, /grid-cols-4/);

    assert.match(info, /lh-chat-info-tabs/);
    assert.match(info, /lh-chat-info-tabs__btn/);
    assert.match(info, /Информация/);
    assert.match(info, /Закрепления/);
    assert.doesNotMatch(info, /overflow-x-auto/);
    assert.doesNotMatch(info, /text-\[10px\]/);
    assert.doesNotMatch(info, /grid-cols-6/);
    const infoTabsBlock = info.slice(
      info.indexOf('lh-chat-info-tabs'),
      info.indexOf('onClose ?'),
    );
    assert.doesNotMatch(infoTabsBlock, /truncate/);

    assert.match(css, /\.lh-chat-filter-tabs/);
    assert.match(css, /flex-wrap:\s*wrap/);
    assert.match(css, /white-space:\s*nowrap/);
    assert.match(css, /flex:\s*0\s+0\s+auto/);
    assert.doesNotMatch(css, /\.lh-chat-filter-tabs[^{]*\{[^}]*overflow-x:\s*auto/);
    assert.doesNotMatch(css, /\.lh-chat-filter-tabs[^{]*\{[^}]*overflow-x:\s*hidden/);

    assert.match(page, /minmax\(17rem/);
  });

  it('header shows info control on desktop (not lg:hidden only)', () => {
    const pane = read('components/chats/ChatMessagePane.jsx');
    assert.match(pane, /Информация о чате/);
    assert.doesNotMatch(
      pane,
      /IconButton className="lg:hidden shrink-0" onClick=\{onOpenInfo\}/,
    );
  });

  it('voice player remains waveform messenger control', () => {
    const voice = read('components/chats/VoicePlayer.jsx');
    const engine = read('components/media/LonghuaAudioPlayer.jsx');
    const hook = read('hooks/useAudioPlayer.js');
    assert.match(voice, /LonghuaAudioPlayer/);
    assert.match(voice, /variant="voice"/);
    assert.match(engine, /lh-chat-voice__wave/);
    assert.match(engine, /lh-chat-voice__speed/);
    assert.match(hook, /setPointerCapture/);
    assert.doesNotMatch(voice, /controls=/);
    assert.doesNotMatch(engine, /\bcontrols=/);
  });

  it('markRead updates shared unread cache (no stale badge resurrection)', () => {
    const page = read('pages/Chats.jsx');
    assert.match(page, /getCachedUnreadSummary/);
    assert.match(page, /applyUnreadSummaryFromSocket/);
  });
});
