import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Stage 4 Web Push / notifications', () => {
  it('migration adds push_subscriptions and event_id idempotency', () => {
    const mig = read(
      'apps/api/src/database/migrations/1746300000000-WebPushAndNotificationEvents.ts',
    );
    assert.match(mig, /push_subscriptions/);
    assert.match(mig, /notification_preferences/);
    assert.match(mig, /event_id/);
    assert.match(mig, /UQ_NOTIFICATION_EVENT_USER_CHANNEL/);
    assert.match(mig, /web_push/);
  });

  it('delivery service is idempotent and fans out web_push', () => {
    const delivery = read(
      'apps/api/src/modules/notifications/notification-delivery.service.ts',
    );
    assert.match(delivery, /createIdempotent/);
    assert.match(delivery, /web_push/);
    assert.match(delivery, /fanoutToRecipient/);
    assert.match(delivery, /UQ_NOTIFICATION_EVENT_USER_CHANNEL/);
  });

  it('web push sender revokes on 404/410 and retries limited', () => {
    const sender = read(
      'apps/api/src/modules/notifications/web-push-sender.service.ts',
    );
    assert.match(sender, /MAX_ATTEMPTS = 3/);
    assert.match(sender, /shouldRevokePushStatus/);
    assert.match(sender, /revokeByEndpoint/);
    assert.doesNotMatch(sender, /process\.env\.VAPID_PRIVATE_KEY/);
    assert.doesNotMatch(sender, /logger\.(log|warn|error|debug)\([^)]*privateKey/);
  });

  it('deep links are role-aware and never ACL', () => {
    const links = read(
      'apps/api/src/modules/notifications/notification-deep-links.ts',
    );
    assert.match(links, /\/Chats\?chatId=/);
    assert.match(links, /StudentLessons/);
    assert.match(links, /HomeworkViewer/);
    assert.match(links, /RoleRouteGuard/);
  });

  it('chat suppresses push while viewing chat room', () => {
    const chat = read(
      'apps/api/src/modules/chats/services/chat-messages.service.ts',
    );
    const gateway = read('apps/api/src/modules/chats/gateway/chat.gateway.ts');
    assert.match(gateway, /getUsersViewingChat/);
    assert.match(chat, /viewing\.has/);
    assert.match(chat, /message\.received/);
    assert.match(chat, /fanoutToRecipient/);
  });

  it('SW has push + notificationclick without breaking Stage 2 bypass', () => {
    const sw = read('public/sw.js');
    assert.match(sw, /addEventListener\('push'/);
    assert.match(sw, /notificationclick/);
    assert.match(sw, /isApiRequest/);
    assert.match(sw, /isSocketRequest/);
    assert.match(sw, /NOTIFICATION_NAVIGATE/);
    assert.doesNotMatch(sw, /VAPID_PRIVATE/);
  });

  it('frontend has progressive permission UX and notification center', () => {
    const settings = read('src/pages/Settings.jsx');
    const center = read('src/components/pwa/NotificationCenter.jsx');
    const push = read('src/lib/pwa/pushClient.js');
    const layout = read('src/Layout.jsx');
    assert.match(settings, /Включить уведомления/);
    assert.match(settings, /enableWebPush/);
    assert.match(settings, /fetchWebPushStatus/);
    assert.match(settings, /Web Push на сервере не настроен/);
    assert.match(center, /Сегодня/);
    assert.match(center, /markAllNotificationsRead/);
    assert.match(push, /requestPermission/);
    assert.match(layout, /NotificationCenter/);
    assert.match(layout, /notification-bell/);
  });

  it('logout revokes only current device push subscription', () => {
    const auth = read('src/lib/AuthContext.jsx');
    assert.match(auth, /revokeCurrentDevicePushSubscription/);
    assert.doesNotMatch(auth, /push-subscriptions\/\$\{/);
  });

  it('VAPID config is server-side only', () => {
    const cfg = read('apps/api/src/config/configuration.ts');
    assert.match(cfg, /VAPID_PUBLIC_KEY/);
    assert.match(cfg, /VAPID_PRIVATE_KEY/);
    const pushClient = read('src/lib/pwa/pushClient.js');
    assert.doesNotMatch(pushClient, /VAPID_PRIVATE/);
    assert.match(pushClient, /vapid-public-key/);
  });

  it('platform event taxonomy exists', () => {
    const types = read(
      'apps/api/src/modules/notifications/platform-event.types.ts',
    );
    assert.match(types, /message\.received/);
    assert.match(types, /lesson\.rescheduled/);
    assert.match(types, /homework\.assigned/);
    assert.match(types, /certificate\.issued/);
  });
});

describe('Stage 4 deep link unit', () => {
  it('resolveNotificationDeepLink maps core events (source contract)', () => {
    const links = read(
      'apps/api/src/modules/notifications/notification-deep-links.ts',
    );
    assert.match(links, /message\.received/);
    assert.match(links, /\/Chats\?chatId=/);
    assert.match(links, /HomeworkViewer/);
    assert.match(links, /TeacherSchedule/);
    assert.match(links, /role === 'admin'/);
    assert.match(links, /\/Schedule/);
  });
});
