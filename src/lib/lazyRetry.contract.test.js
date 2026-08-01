import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHUNK_UPDATE_MESSAGE, isChunkLoadError } from './lazyRetry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('lazy chunk recovery', () => {
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
  });

  it('uses lazyRetry for AdminPanel and other pages', () => {
    const app = readFileSync(join(root, 'App.jsx'), 'utf8');
    assert.match(app, /lazyRetry/);
    assert.match(app, /lazyRetry\(\(\) => import\('\.\/pages\/AdminPanel'\)\)/);
    assert.match(app, /lazyRetry\(\(\) => import\('\.\/pages\/LowBalanceStudents'\)\)/);
    assert.doesNotMatch(app, /\blazy\(\(\) => import\(/);
  });

  it('error boundary auto-reloads with update message on chunk errors', () => {
    const boundary = readFileSync(
      join(root, 'components/common/AppErrorBoundary.jsx'),
      'utf8',
    );
    assert.match(boundary, /CHUNK_UPDATE_MESSAGE/);
    assert.match(boundary, /hardReloadForStaleChunks/);
    assert.match(boundary, /claimChunkAutoReload/);
    assert.match(boundary, /Попробовать снова|Перезагрузить сейчас/);
    assert.match(boundary, /setTimeout/);
    assert.equal(
      CHUNK_UPDATE_MESSAGE,
      'Приложение было обновлено. Страница будет автоматически перезагружена.',
    );
  });

  it('preserves previous Vite assets across client builds', () => {
    const pkg = readFileSync(join(root, '../package.json'), 'utf8');
    const script = readFileSync(
      join(root, '../scripts/build-client-preserve-assets.mjs'),
      'utf8',
    );
    assert.match(pkg, /build-client-preserve-assets/);
    assert.match(script, /previousGeneration|asset-generations/);
    assert.match(script, /restoreMissingFromStash/);
  });

  it('service worker does not precache index.html', () => {
    const sw = readFileSync(join(root, '../public/sw.js'), 'utf8');
    assert.match(sw, /longhua-academy-shell-v5/);
    assert.doesNotMatch(sw, /PRECACHE = \[[^\]]*['"]\/['"]/);
    assert.match(sw, /isHtmlNavigation|HTML shell must always come from network/);
  });
});
