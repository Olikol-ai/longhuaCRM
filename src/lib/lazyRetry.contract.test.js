import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractChunkUrl,
  isChunkLoadError,
} from './frontendUpdate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('frontend update recovery', () => {
  it('detects dynamic import / chunk load failures', () => {
    assert.equal(
      isChunkLoadError({
        message:
          'Failed to fetch dynamically imported module: https://lk.longhuachinese.online/assets/AdminPanel-CrlMmeRR.js',
      }),
      true,
    );
    assert.equal(isChunkLoadError({ message: 'ChunkLoadError', name: 'ChunkLoadError' }), true);
    assert.equal(isChunkLoadError({ message: 'Ordinary render bug' }), false);
    assert.equal(
      extractChunkUrl({
        message:
          'Failed to fetch dynamically imported module: https://lk.longhuachinese.online/assets/AdminPanel-CrlMmeRR.js',
      }),
      'https://lk.longhuachinese.online/assets/AdminPanel-CrlMmeRR.js',
    );
  });

  it('uses a single FrontendUpdateScreen for all update flows', () => {
    const boundary = readFileSync(
      join(root, 'components/common/AppErrorBoundary.jsx'),
      'utf8',
    );
    const screen = readFileSync(
      join(root, 'components/common/FrontendUpdateScreen.jsx'),
      'utf8',
    );
    const main = readFileSync(join(root, 'main.jsx'), 'utf8');
    const updateLib = readFileSync(join(root, 'lib/frontendUpdate.js'), 'utf8');

    assert.match(boundary, /FrontendUpdateScreen/);
    assert.doesNotMatch(boundary, /Longhua CRM была обновлена/);
    assert.match(main, /FrontendUpdateScreen/);
    assert.match(main, /mountFrontendUpdateOverlay/);
    assert.match(screen, /Longhua CRM была обновлена/);
    assert.match(screen, /Загружаем новую версию приложения/);
    assert.match(screen, /Это займёт всего несколько секунд/);
    assert.match(screen, /Longhua CRM не удалось обновить автоматически/);
    assert.match(screen, /Обновить сейчас/);
    assert.match(screen, /onAutoReload/);
    assert.doesNotMatch(screen, /Failed to fetch|ChunkLoadError|MIME type|stack/i);
    assert.match(updateLib, /saveNavigationStateForUpdate/);
    assert.match(updateLib, /finalizeFrontendUpdateRecovery/);
    assert.match(updateLib, /recordFrontendUpdateEvent/);
    assert.match(updateLib, /getFrontendBuildId/);
    assert.match(updateLib, /FRONTEND_UPDATE_EVENTS_KEY/);
  });

  it('lazyRetry re-exports recovery helpers', () => {
    const app = readFileSync(join(root, 'App.jsx'), 'utf8');
    const lazyRetry = readFileSync(join(root, 'lib/lazyRetry.js'), 'utf8');
    assert.match(app, /lazyRetry/);
    assert.match(lazyRetry, /from '\.\/frontendUpdate\.js'/);
    assert.match(app, /lazyRetry\(\(\) => import\('\.\/pages\/AdminPanel'\)\)/);
  });

  it('preserves previous Vite assets across client builds', () => {
    const pkg = readFileSync(join(root, '../package.json'), 'utf8');
    const script = readFileSync(
      join(root, '../scripts/build-client-preserve-assets.mjs'),
      'utf8',
    );
    assert.match(pkg, /build-client-preserve-assets/);
    assert.match(script, /previousGeneration|asset-generations/);
  });
});
