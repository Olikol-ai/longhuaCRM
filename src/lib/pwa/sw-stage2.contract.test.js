import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  shouldBypassServiceWorker,
  isVersionedStaticAsset,
  isNavigationRequest,
  isApiRequest,
  isSocketRequest,
  hasAuthQueryToken,
  isMaterialMediaPath,
  pwaCacheName,
} from './swResourceRules.js';
import { PLACEHOLDER } from '../../../scripts/pwa-build-id.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');
const sw = readFileSync(join(root, 'public/sw.js'), 'utf8');

describe('SW resource rules (Stage 2)', () => {
  const origin = 'https://crm.example.com';

  it('bypasses API, socket, uploads, auth query, materials', () => {
    assert.equal(isApiRequest(new URL('/api/students', origin)), true);
    assert.equal(isSocketRequest(new URL('/socket.io/?EIO=4', origin)), true);
    assert.equal(hasAuthQueryToken(new URL('/icons/x.png?access_token=abc', origin)), true);
    assert.equal(isMaterialMediaPath(new URL('/api/files/x/download', origin)), true);
    assert.equal(isMaterialMediaPath(new URL('/docs/lecture.pdf', origin)), true);

    assert.equal(
      shouldBypassServiceWorker(new URL('/api/lessons', origin), origin),
      true,
    );
    assert.equal(
      shouldBypassServiceWorker(new URL('/socket.io/', origin), origin),
      true,
    );
    assert.equal(
      shouldBypassServiceWorker(new URL('/uploads/a.bin', origin), origin),
      true,
    );
    assert.equal(
      shouldBypassServiceWorker(
        new URL('/media/a.mp3?access_token=secret', origin),
        origin,
      ),
      true,
    );
  });

  it('bypasses cross-origin (Jitsi)', () => {
    assert.equal(
      shouldBypassServiceWorker(new URL('https://meet.jit.si/room'), origin),
      true,
    );
  });

  it('classifies navigation and hashed assets', () => {
    assert.equal(
      isNavigationRequest({ mode: 'navigate', headers: { get: () => '' } }, new URL('/', origin)),
      true,
    );
    assert.equal(
      isVersionedStaticAsset(new URL('/assets/index-AbCdEf12.js', origin)),
      true,
    );
    assert.equal(
      isVersionedStaticAsset(new URL('/not-assets/x.js', origin)),
      false,
    );
  });

  it('cache name is BUILD_ID scoped', () => {
    assert.equal(pwaCacheName('abc'), 'longhua-academy-pwa-abc');
  });
});

describe('SW Stage 2 source contracts', () => {
  it('does not skipWaiting unconditionally on install', () => {
    assert.match(sw, /SKIP_WAITING/);
    assert.match(sw, /!self\.registration\.active/);
    assert.match(sw, /Do NOT skipWaiting on update/);
    assert.doesNotMatch(
      sw,
      /cache\.addAll\(PRECACHE\)\)\.then\(\(\) => self\.skipWaiting\(\)\)/,
    );
  });

  it('declares class strategies and bypass markers', () => {
    assert.match(sw, /NETWORK FIRST/);
    assert.match(sw, /CACHE FIRST/);
    assert.match(sw, /isApiRequest/);
    assert.match(sw, /isSocketRequest/);
    assert.match(sw, /access_token/);
    assert.match(sw, /isMaterialMediaPath/);
    assert.match(sw, /isVersionedStaticAsset/);
    assert.match(sw, /isNavigationRequest/);
    assert.match(sw, /htmlAsJsGuardResponse/);
    assert.match(sw, /longhua-academy-/);
    assert.match(sw, new RegExp(PLACEHOLDER));
  });

  it('cleans only longhua caches on activate', () => {
    assert.match(sw, /key\.startsWith\('longhua-academy-'\)/);
    assert.match(sw, /clients\.claim/);
  });

  it('client update path is confirm-only for SW', () => {
    const client = readFileSync(join(root, 'src/lib/pwa/serviceWorkerClient.js'), 'utf8');
    const ui = readFileSync(join(root, 'src/components/pwa/PwaUpdateController.jsx'), 'utf8');
    const screen = readFileSync(
      join(root, 'src/components/common/FrontendUpdateScreen.jsx'),
      'utf8',
    );
    assert.match(client, /activateWaitingServiceWorkerAndReload/);
    assert.match(client, /available/);
    assert.match(ui, /phase === 'available'/);
    assert.match(ui, /Обновление будет выполнено после завершения урока/);
    assert.match(screen, /Доступна новая версия Longhua CRM/);
    assert.match(screen, /frontend-update-later/);
    assert.doesNotMatch(ui, /startReload\('sw_auto'\)/);
  });

  it('VideoSession still owns reload gate', () => {
    const video = readFileSync(join(root, 'src/lib/VideoSessionContext.jsx'), 'utf8');
    assert.match(video, /setVideoSessionBlocksReload/);
  });
});
