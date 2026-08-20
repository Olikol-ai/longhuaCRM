import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withTimeout } from './asyncBounded.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('logout hang regression', () => {
  it('clears token before awaiting push revoke (no partial-session spinner)', () => {
    const auth = read('lib/AuthContext.jsx');
    const logoutBody = auth.slice(auth.indexOf('const logout = useCallback'));
    const tokenIdx = logoutBody.indexOf('setToken(null)');
    const revokeIdx = logoutBody.indexOf('revokeCurrentDevicePushSubscription');
    assert.ok(tokenIdx >= 0, 'logout must clear token');
    assert.ok(revokeIdx >= 0, 'logout still attempts device push revoke');
    assert.ok(
      tokenIdx < revokeIdx,
      'setToken(null) must run before await revoke — otherwise token && !isAuthenticated hangs AuthLoadingScreen',
    );
  });

  it('uses Promise.allSettled + bounded timeout for optional cleanup', () => {
    const auth = read('lib/AuthContext.jsx');
    assert.match(auth, /Promise\.allSettled/);
    assert.match(auth, /withTimeout/);
    assert.match(auth, /LOGOUT_OPTIONAL_TIMEOUT_MS|2500/);
    assert.match(auth, /disconnectChatSocket/);
    assert.match(auth, /clearAllOfflineData/);
    assert.match(auth, /location\.assign\('\/login'\)|location\.href = '\/login'/);
  });

  it('guards against double-click logout race', () => {
    const auth = read('lib/AuthContext.jsx');
    assert.match(auth, /loggingOutRef/);
    assert.match(auth, /isLoggingOut/);
  });

  it('push revoke never awaits unbounded serviceWorker.ready', () => {
    const push = read('lib/pwa/pushClient.js');
    const fn = push.slice(push.indexOf('export async function revokeCurrentDevicePushSubscription'));
    assert.match(fn, /withTimeout/);
    assert.match(fn, /by-endpoint\?endpoint=/);
    assert.match(fn, /subscription\.unsubscribe/);
    // Must not bare-await ready without a bound.
    assert.doesNotMatch(
      fn.split('withTimeout')[0],
      /await navigator\.serviceWorker\.ready(?!\.catch)/,
    );
  });

  it('device-scoped revoke only (other devices preserved)', () => {
    const auth = read('lib/AuthContext.jsx');
    const push = read('lib/pwa/pushClient.js');
    assert.match(auth, /revokeCurrentDevicePushSubscription/);
    assert.doesNotMatch(auth, /push-subscriptions\/\$\{/);
    assert.match(push, /by-endpoint\?endpoint=/);
  });

  it('partial session gate explains the hang when token outlives isAuthenticated', () => {
    const gate = read('lib/auth-gate.jsx');
    assert.match(gate, /token && !isAuthenticated/);
    assert.match(gate, /AuthLoadingScreen|Загрузка сессии/);
  });
});

describe('withTimeout', () => {
  it('resolves fallback when promise never settles', async () => {
    const started = Date.now();
    const value = await withTimeout(new Promise(() => {}), 40, 'fallback');
    assert.equal(value, 'fallback');
    assert.ok(Date.now() - started < 500);
  });

  it('returns resolved value when faster than timeout', async () => {
    const value = await withTimeout(Promise.resolve('ok'), 200, 'fallback');
    assert.equal(value, 'ok');
  });

  it('maps rejection to fallback', async () => {
    const value = await withTimeout(Promise.reject(new Error('boom')), 200, 'fallback');
    assert.equal(value, 'fallback');
  });
});
