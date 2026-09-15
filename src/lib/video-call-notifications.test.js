import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VIDEO_NOTIF_KINDS,
  buildVideoNotifEvent,
  claimVideoNotifKey,
  releaseVideoNotifKey,
  clearVideoNotifDedupe,
  handRaiseDedupeKey,
  chatMessageDedupeKey,
  pingDedupeKey,
  shouldShowOsNotification,
  resolveVideoNotifChannels,
  pushToastStack,
  unreadCenterCount,
  pushCenterList,
  markAllCenterRead,
  encodeVideoPingPayload,
  parseVideoPingPayload,
} from './video-call-notifications.js';

describe('video-call-notifications', () => {
  it('dedupes hand raise until released', () => {
    clearVideoNotifDedupe();
    const key = handRaiseDedupeKey('L1', 'S1');
    assert.equal(claimVideoNotifKey(key), true);
    assert.equal(claimVideoNotifKey(key), false);
    releaseVideoNotifKey(key);
    assert.equal(claimVideoNotifKey(key), true);
  });

  it('builds events with actions', () => {
    const hand = buildVideoNotifEvent({
      kind: VIDEO_NOTIF_KINDS.HAND,
      title: 'Оксана',
      body: 'Подняла руку',
      lessonId: 'L',
      actorId: 'U',
    });
    assert.equal(hand.action, 'open_participants');
    assert.match(hand.actionHint, /посмотреть/i);

    const chat = buildVideoNotifEvent({
      kind: VIDEO_NOTIF_KINDS.CHAT,
      lessonId: 'L',
      messageId: 'M1',
      dedupeKey: chatMessageDedupeKey('L', 'M1'),
    });
    assert.equal(chat.action, 'open_chat');
  });

  it('shows OS notification when background or screen sharing', () => {
    assert.equal(
      shouldShowOsNotification({ documentHidden: true, documentFocused: false }),
      true,
    );
    assert.equal(
      shouldShowOsNotification({
        documentHidden: false,
        documentFocused: true,
        screenSharing: true,
      }),
      true,
    );
    assert.equal(
      shouldShowOsNotification({
        documentHidden: false,
        documentFocused: true,
        screenSharing: false,
        viewingTarget: true,
      }),
      false,
    );
    assert.equal(
      shouldShowOsNotification({
        documentHidden: false,
        documentFocused: true,
        screenSharing: false,
      }),
      false,
    );
  });

  it('resolves channels with permission', () => {
    const a = resolveVideoNotifChannels({
      permission: 'granted',
      screenSharing: true,
    });
    assert.equal(a.toast, true);
    assert.equal(a.center, true);
    assert.equal(a.os, true);

    const b = resolveVideoNotifChannels({
      permission: 'denied',
      screenSharing: true,
    });
    assert.equal(b.os, false);
  });

  it('stacks toasts without duplicate ids', () => {
    const e1 = buildVideoNotifEvent({ kind: VIDEO_NOTIF_KINDS.HAND, id: 'a' });
    const e2 = buildVideoNotifEvent({ kind: VIDEO_NOTIF_KINDS.CHAT, id: 'b' });
    const stack = pushToastStack(pushToastStack([], e1), e2);
    assert.equal(stack.length, 2);
    assert.equal(stack[0].id, 'b');
  });

  it('tracks unread center count', () => {
    const e = buildVideoNotifEvent({ kind: VIDEO_NOTIF_KINDS.PING, id: 'p1' });
    let list = pushCenterList([], e);
    assert.equal(unreadCenterCount(list), 1);
    list = markAllCenterRead(list);
    assert.equal(unreadCenterCount(list), 0);
  });

  it('encodes and parses attention ping payload', () => {
    const raw = encodeVideoPingPayload({
      displayName: 'Оксана',
      crmUserId: 'u1',
    });
    const parsed = parseVideoPingPayload(raw);
    assert.equal(parsed.name, 'Оксана');
    assert.equal(parsed.crmUserId, 'u1');
    assert.equal(parseVideoPingPayload('not-json'), null);
  });

  it('throttles ping keys by time bucket', () => {
    clearVideoNotifDedupe();
    const k = pingDedupeKey('L', 'S');
    assert.equal(claimVideoNotifKey(k), true);
    assert.equal(claimVideoNotifKey(k), false);
  });
});
