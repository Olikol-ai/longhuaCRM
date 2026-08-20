import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isDisplayStandalone,
  isIosSafariLike,
  shouldOfferInstallUi,
  dismissInstallPrompt,
  clearInstallPromptDismiss,
  PWA_INSTALL_DISMISS_KEY,
} from './installState.js';
import {
  setVideoSessionBlocksReload,
  shouldDeferAppReload,
} from './reloadGate.js';
import { PLACEHOLDER } from '../../../scripts/pwa-build-id.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('PWA Stage 1 identity', () => {
  it('keeps a single BUILD_ID placeholder across manifest, SW, and index.html', () => {
    const manifest = read('public/manifest.webmanifest');
    const sw = read('public/sw.js');
    const html = read('index.html');
    assert.match(manifest, new RegExp(PLACEHOLDER));
    assert.match(sw, new RegExp(`BUILD_ID = '${PLACEHOLDER}'`));
    assert.match(html, new RegExp(PLACEHOLDER));
    assert.equal(
      (manifest.match(new RegExp(PLACEHOLDER, 'g')) || []).length > 0,
      true,
    );
  });

  it('SW bypasses API, Socket.IO, uploads and never precaches index.html', () => {
    const sw = read('public/sw.js');
    assert.match(sw, /pathname\.startsWith\('\/api'\)/);
    assert.match(sw, /pathname\.startsWith\('\/socket\.io'\)/);
    assert.match(sw, /pathname\.startsWith\('\/uploads'\)/);
    assert.match(sw, /Never precache index\.html|NETWORK FIRST/);
    assert.match(sw, /url\.pathname\.startsWith\('\/assets\/'\)/);
    assert.match(sw, /url\.origin !== self\.location\.origin/);
    assert.match(sw, /isVersionedStaticAsset|CACHE FIRST/);
    assert.doesNotMatch(sw, /cache\.addAll\(\[[^\]]*jitsi/i);
  });

  it('manifest has production identity fields and role-safe shortcuts', () => {
    const manifest = JSON.parse(
      read('public/manifest.webmanifest').split(PLACEHOLDER).join('testbuild'),
    );
    assert.equal(manifest.name, 'Longhua Academy');
    assert.equal(manifest.short_name, 'Longhua');
    assert.equal(manifest.id, '/');
    assert.equal(manifest.display, 'standalone');
    assert.ok(Array.isArray(manifest.display_override));
    assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
    assert.ok(manifest.shortcuts.some((s) => s.url.startsWith('/Chats')));
    assert.ok(manifest.shortcuts.some((s) => s.url.startsWith('/Profile')));
    assert.ok(manifest.shortcuts.some((s) => s.url.startsWith('/Settings')));
    assert.equal(Object.prototype.hasOwnProperty.call(manifest, 'screenshots'), false);
  });

  it('main registers SW via shared serviceWorkerScriptUrl / build id helper', () => {
    const main = read('src/main.jsx');
    assert.match(main, /registerLonghuaServiceWorker/);
    assert.doesNotMatch(main, /sw\.js\?v=20260801d/);
    assert.match(main, /claimChunkAutoReloadUnlessVideo/);
    assert.match(main, /shouldDeferAppReload/);
  });

  it('vite stamps BUILD_ID into dist assets', () => {
    const vite = read('vite.config.js');
    assert.match(vite, /computeLhPwaBuildId/);
    assert.match(vite, /VITE_LH_PWA_BUILD_ID/);
    assert.match(vite, /longhua-pwa-build-id/);
    assert.match(vite, /lh-pwa-build-id\.json/);
  });

  it('reload gate defers while video session is active', () => {
    setVideoSessionBlocksReload(false);
    assert.equal(shouldDeferAppReload(), false);
    setVideoSessionBlocksReload(true);
    assert.equal(shouldDeferAppReload(), true);
    setVideoSessionBlocksReload(false);
    assert.equal(shouldDeferAppReload(), false);
  });

  it('install helpers hide prompt when standalone or dismissed', () => {
    assert.equal(shouldOfferInstallUi({ standalone: true, dismissed: false }), false);
    assert.equal(shouldOfferInstallUi({ standalone: false, dismissed: true }), false);
    assert.equal(shouldOfferInstallUi({ standalone: false, dismissed: false }), true);
    assert.equal(typeof isDisplayStandalone(), 'boolean');
    assert.equal(typeof isIosSafariLike(), 'boolean');
  });

  it('install dismiss persistence key is stable', () => {
    assert.equal(PWA_INSTALL_DISMISS_KEY, 'lh_pwa_install_dismissed_at');
    // Node has no localStorage — functions must not throw.
    clearInstallPromptDismiss();
    dismissInstallPrompt(Date.now());
  });

  it('VideoSession wires reload gate; App mounts install/update controllers', () => {
    const video = read('src/lib/VideoSessionContext.jsx');
    const app = read('src/App.jsx');
    assert.match(video, /setVideoSessionBlocksReload/);
    assert.match(app, /PwaInstallController/);
    assert.match(app, /PwaUpdateController/);
  });
});

describe('PWA Stage 1 dist stamp (when built)', () => {
  it('dist build id is consistent across sw, manifest, stamp file', () => {
    const stampPath = join(root, 'dist/lh-pwa-build-id.json');
    if (!existsSync(stampPath)) return;
    const stamp = JSON.parse(readFileSync(stampPath, 'utf8'));
    const buildId = stamp.buildId;
    assert.ok(buildId && buildId !== PLACEHOLDER);
    const sw = readFileSync(join(root, 'dist/sw.js'), 'utf8');
    const manifest = readFileSync(join(root, 'dist/manifest.webmanifest'), 'utf8');
    const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
    assert.match(sw, new RegExp(`BUILD_ID = '${buildId}'`));
    assert.doesNotMatch(sw, new RegExp(PLACEHOLDER));
    assert.match(manifest, new RegExp(buildId));
    assert.doesNotMatch(manifest, new RegExp(PLACEHOLDER));
    assert.match(html, new RegExp(buildId));
  });
});
