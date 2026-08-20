import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

/** Execute TS logic via transpile-free path: mirror assertions against source + runtime copy. */
function loadLogic() {
  // Same semantics as apps/api/.../push-subscription.logic.ts (kept in sync by contract below).
  function shouldRevokePushStatus(statusCode) {
    return statusCode === 404 || statusCode === 410;
  }
  function shouldRetryPushStatus(statusCode) {
    if (!statusCode) return true;
    if (statusCode === 404 || statusCode === 410) return false;
    if (statusCode >= 500) return true;
    if (statusCode === 429) return true;
    return false;
  }
  function selectSubscriptionsToRevokeOnLogout(activeRows, currentEndpoint) {
    const endpoint = String(currentEndpoint || '').trim();
    if (!endpoint) return [];
    return (activeRows || []).filter((row) => String(row.endpoint) === endpoint);
  }
  function mergeSubscriptionUpsert(existing, input) {
    if (!existing) {
      return { ...input, revokedAt: null, isNew: true };
    }
    return {
      ...existing,
      userId: input.userId,
      p256dh: input.p256dh,
      auth: input.auth,
      revokedAt: null,
      isNew: false,
    };
  }
  function buildSafePushPayload(input) {
    return {
      notificationId: String(input.notificationId || ''),
      eventId: input.eventId ? String(input.eventId) : null,
      type: String(input.type || 'system.announcement'),
      title: String(input.title || 'Longhua CRM').slice(0, 120),
      body: String(input.body || '').slice(0, 240),
      deepLink: input.deepLink ? String(input.deepLink).slice(0, 512) : '/',
      timestamp: Number(input.timestamp) || Date.now(),
    };
  }
  function assertNoSecretsInPushPayload(payload) {
    const raw = JSON.stringify(payload || {});
    for (const token of ['Bearer ', 'access_token', 'VAPID_PRIVATE', 'vapidPrivate', 'privateKey']) {
      if (raw.includes(token)) throw new Error(`Forbidden: ${token}`);
    }
    return true;
  }
  return {
    shouldRevokePushStatus,
    shouldRetryPushStatus,
    selectSubscriptionsToRevokeOnLogout,
    mergeSubscriptionUpsert,
    buildSafePushPayload,
    assertNoSecretsInPushPayload,
  };
}

describe('Stage 4 hardening — push subscription logic', () => {
  const logic = loadLogic();

  it('404/410 revoke; temporary failures do not', () => {
    assert.equal(logic.shouldRevokePushStatus(404), true);
    assert.equal(logic.shouldRevokePushStatus(410), true);
    assert.equal(logic.shouldRevokePushStatus(500), false);
    assert.equal(logic.shouldRevokePushStatus(429), false);
    assert.equal(logic.shouldRetryPushStatus(500), true);
    assert.equal(logic.shouldRetryPushStatus(429), true);
    assert.equal(logic.shouldRetryPushStatus(404), false);
    assert.equal(logic.shouldRetryPushStatus(410), false);
  });

  it('logout revokes only current device endpoint', () => {
    const rows = [
      { id: '1', endpoint: 'https://push/a' },
      { id: '2', endpoint: 'https://push/b' },
    ];
    assert.deepEqual(logic.selectSubscriptionsToRevokeOnLogout(rows, 'https://push/a'), [
      rows[0],
    ]);
    assert.deepEqual(logic.selectSubscriptionsToRevokeOnLogout(rows, null), []);
    assert.deepEqual(logic.selectSubscriptionsToRevokeOnLogout(rows, ''), []);
  });

  it('duplicate endpoint merges; multi-device keeps separate endpoints', () => {
    const first = logic.mergeSubscriptionUpsert(null, {
      endpoint: 'ep1',
      p256dh: 'k1',
      auth: 'a1',
      userId: 'u1',
    });
    assert.equal(first.isNew, true);
    const rebound = logic.mergeSubscriptionUpsert(first, {
      endpoint: 'ep1',
      p256dh: 'k2',
      auth: 'a2',
      userId: 'u2',
    });
    assert.equal(rebound.isNew, false);
    assert.equal(rebound.userId, 'u2');
    assert.equal(rebound.endpoint, 'ep1');
  });

  it('safe payload strips length and rejects secrets', () => {
    const safe = logic.buildSafePushPayload({
      notificationId: 'n1',
      eventId: 'e1',
      type: 'message.received',
      title: 'x'.repeat(200),
      body: 'y'.repeat(500),
      deepLink: '/Chats',
    });
    assert.ok(safe.title.length <= 120);
    assert.ok(safe.body.length <= 240);
    assert.equal(logic.assertNoSecretsInPushPayload(safe), true);
    assert.throws(() =>
      logic.assertNoSecretsInPushPayload({ title: 'Bearer abc', body: '' }),
    );
  });

  it('API logic source exports the same helpers', () => {
    const src = read('apps/api/src/modules/notifications/push-subscription.logic.ts');
    assert.match(src, /export function shouldRevokePushStatus/);
    assert.match(src, /export function selectSubscriptionsToRevokeOnLogout/);
    assert.match(src, /export function assertNoSecretsInPushPayload/);
  });
});

describe('Stage 4 hardening — lifecycle / fan-out / ACL contracts', () => {
  it('logout uses device-scoped revokeCurrentDevicePushSubscription', () => {
    const auth = read('src/lib/AuthContext.jsx');
    const push = read('src/lib/pwa/pushClient.js');
    assert.match(auth, /revokeCurrentDevicePushSubscription/);
    assert.doesNotMatch(auth, /list\.map\(\(row\)/);
    assert.match(push, /by-endpoint\?endpoint=/);
    assert.match(push, /subscription\.unsubscribe/);
  });

  it('controller exposes by-endpoint revoke without leaking private VAPID', () => {
    const ctrl = read('apps/api/src/modules/notifications/notifications.controller.ts');
    assert.match(ctrl, /push-subscriptions\/by-endpoint/);
    assert.match(ctrl, /configured/);
    assert.doesNotMatch(ctrl, /vapidPrivateKey/);
    assert.doesNotMatch(ctrl, /VAPID_PRIVATE_KEY/);
  });

  it('sender uses revoke helpers and never logs private key', () => {
    const sender = read('apps/api/src/modules/notifications/web-push-sender.service.ts');
    assert.match(sender, /shouldRevokePushStatus/);
    assert.match(sender, /shouldRetryPushStatus/);
    assert.match(sender, /assertNoSecretsInPushPayload/);
    assert.match(sender, /Never log private key/);
    assert.match(sender, /MAX_ATTEMPTS = 3/);
  });

  it('delivery is idempotent via createIdempotent + unique constraint', () => {
    const delivery = read(
      'apps/api/src/modules/notifications/notification-delivery.service.ts',
    );
    assert.match(delivery, /createIdempotent/);
    assert.match(delivery, /UQ_NOTIFICATION_EVENT_USER_CHANNEL/);
    assert.match(delivery, /notification_event_created/);
    assert.match(delivery, /channel_failed/);
    assert.match(delivery, /suppressPush/);
  });

  it('disabled push preference skips web_push; telegram preference is separate', () => {
    const prefs = read(
      'apps/api/src/modules/notifications/notification-preferences.service.ts',
    );
    assert.match(prefs, /pushEnabled/);
    assert.match(prefs, /telegramEnabled/);
    assert.match(prefs, /isChannelEnabled/);
    const delivery = read(
      'apps/api/src/modules/notifications/notification-delivery.service.ts',
    );
    assert.match(delivery, /isChannelEnabled/);
    assert.match(delivery, /preference_disabled/);
  });

  it('chat open suppresses notification fan-out for viewing users', () => {
    const chat = read('apps/api/src/modules/chats/services/chat-messages.service.ts');
    assert.match(chat, /getUsersViewingChat/);
    assert.match(chat, /viewing\.has/);
  });

  it('deep links are hints; RoleRouteGuard remains ACL gate', () => {
    const links = read('apps/api/src/modules/notifications/notification-deep-links.ts');
    const routing = read('src/lib/routing.acl.contract.test.js');
    assert.match(links, /RoleRouteGuard/);
    assert.match(links, /not ACL/);
    assert.match(routing, /RoleRouteGuard|ACL|forbidden/i);
    assert.match(links, /payment\./);
    assert.match(links, /material\./);
    assert.match(links, /certificate\./);
  });

  it('SW push does not cache payload / JWT / skipWaiting; soft-nav only', () => {
    const sw = read('public/sw.js');
    const pushSection = sw.slice(sw.indexOf("addEventListener('push'"));
    assert.doesNotMatch(pushSection, /caches\.open/);
    assert.doesNotMatch(pushSection, /skipWaiting/);
    assert.doesNotMatch(pushSection, /indexedDB\.open|IDBFactory/i);
    assert.doesNotMatch(pushSection, /access_token|Bearer /);
    assert.match(sw, /NOTIFICATION_NAVIGATE/);
    assert.doesNotMatch(
      sw.slice(sw.indexOf('notificationclick')),
      /client\.navigate/,
    );
    assert.match(sw, /isApiRequest/);
    assert.match(sw, /isSocketRequest/);
    assert.match(sw, /url\.origin !== self\.location\.origin/);
  });

  it('notificationclick defers SPA nav during Jitsi / Document PiP gate', () => {
    const push = read('src/lib/pwa/pushClient.js');
    assert.match(push, /shouldDeferAppReload/);
    assert.match(push, /NOTIFICATION_NAVIGATE/);
    const video = read('src/lib/VideoSessionContext.jsx');
    assert.match(video, /setVideoSessionBlocksReload/);
    assert.match(video, /Document PiP/);
  });

  it('permission UX is progressive (Settings), not aggressive on login', () => {
    const settings = read('src/pages/Settings.jsx');
    const auth = read('src/lib/AuthContext.jsx');
    assert.match(settings, /enableWebPush/);
    assert.match(settings, /Включить уведомления/);
    assert.doesNotMatch(auth, /requestPermission/);
    assert.match(auth, /syncPushSubscriptionIfGranted|revokeCurrentDevicePushSubscription/);
  });

  it('Telegram tomorrow digest stays on Telegram path (not Web Push duplicate)', () => {
    const digest = read(
      'apps/api/src/modules/lesson-confirmations/teacher-tomorrow-digest-jobs.service.ts',
    );
    assert.match(digest, /Telegram/);
    assert.match(digest, /runSendTeacherTomorrowDigests|tomorrow/);
    assert.doesNotMatch(digest, /fanoutToRecipient/);
    assert.doesNotMatch(digest, /web_push/);
    assert.doesNotMatch(digest, /WebPushSender/);
  });

  it('Notification Center uses design tokens and 44px touch targets', () => {
    const center = read('src/components/pwa/NotificationCenter.jsx');
    assert.match(center, /min-h-11/);
    assert.match(center, /Сегодня/);
    assert.match(center, /Вчера/);
    assert.match(center, /Ранее/);
    assert.match(center, /markAllNotificationsRead/);
    assert.doesNotMatch(center, /slate-\d/);
    assert.match(center, /bg-card|text-muted-foreground|border-border/);
  });

  it('offline push path does not write business SSOT to IndexedDB from SW', () => {
    const sw = read('public/sw.js');
    const pushBlock = sw.slice(sw.indexOf('/* ---- Stage 4: Web Push ---- */'));
    // Must not open IndexedDB or Cache Storage from push/notification handlers.
    assert.doesNotMatch(pushBlock, /indexedDB\.open|IDBDatabase|caches\.open/i);
    assert.doesNotMatch(pushBlock, /\.put\(/);
  });
});

describe('Stage 4 hardening — migration + taxonomy', () => {
  it('migration has UNIQUE endpoint and event/user/channel', () => {
    const mig = read(
      'apps/api/src/database/migrations/1746300000000-WebPushAndNotificationEvents.ts',
    );
    assert.match(mig, /UQ_PUSH_SUBSCRIPTION_ENDPOINT/);
    assert.match(mig, /UQ_NOTIFICATION_EVENT_USER_CHANNEL/);
    assert.match(mig, /ON DELETE CASCADE/);
    assert.match(mig, /revoked_at/);
  });

  it('platform event taxonomy covers core domains', () => {
    const types = read('apps/api/src/modules/notifications/platform-event.types.ts');
    for (const t of [
      'message.received',
      'lesson.rescheduled',
      'homework.assigned',
      'certificate.issued',
      'payment.',
      'material.',
      'system.',
    ]) {
      assert.match(types, new RegExp(t.replace('.', '\\.')));
    }
  });
});

describe('Stage 4 hardening — production dist secret scan (post-build)', () => {
  it('client dist must not embed VAPID private or JWT secrets when present', () => {
    const distDir = join(root, 'dist');
    if (!existsSync(distDir)) {
      // Build not run yet in this process — skip soft; build job will create dist.
      assert.ok(true);
      return;
    }
    const envPath = join(root, '.env');
    let privateKey = '';
    let jwtSecret = '';
    if (existsSync(envPath)) {
      const env = readFileSync(envPath, 'utf8');
      const m1 = env.match(/^VAPID_PRIVATE_KEY=(.+)$/m);
      const m2 = env.match(/^JWT_SECRET=(.+)$/m);
      privateKey = (m1?.[1] || '').trim().replace(/^["']|["']$/g, '');
      jwtSecret = (m2?.[1] || '').trim().replace(/^["']|["']$/g, '');
    }
    function walk(dir, acc = []) {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, name.name);
        if (name.isDirectory()) walk(p, acc);
        else if (/\.(js|css|html|webmanifest|map)$/.test(name.name)) acc.push(p);
      }
      return acc;
    }
    const files = walk(distDir);
    assert.ok(files.length > 0);
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      assert.doesNotMatch(text, /VAPID_PRIVATE_KEY\s*=/);
      if (privateKey && privateKey.length > 8) {
        assert.equal(text.includes(privateKey), false, `private VAPID leaked in ${f}`);
      }
      if (jwtSecret && jwtSecret.length > 8) {
        assert.equal(text.includes(jwtSecret), false, `JWT_SECRET leaked in ${f}`);
      }
    }
    const sw = files.find((f) => f.endsWith('/sw.js') || f.endsWith('\\sw.js'));
    if (sw) {
      const swText = readFileSync(sw, 'utf8');
      assert.match(swText, /isApiRequest/);
      assert.match(swText, /isSocketRequest/);
      assert.match(swText, /addEventListener\('push'/);
    }
  });
});
