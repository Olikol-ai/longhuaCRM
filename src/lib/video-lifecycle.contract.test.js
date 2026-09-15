import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isAuthVideoError,
  isTransientVideoError,
  isUnrecoverableVideoFailure,
} from './video-diagnostics.js';
import {
  VIDEO_CONNECTION_STATUS,
  isLiveVideoConnectionStatus,
} from './lesson-video.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('video JWT / connection lifecycle contracts', () => {
  it('production TTL is 4h — excludes ~10 minute JWT expiry as root cause', () => {
    const envPath = join(root, '.env');
    assert.ok(existsSync(envPath), '.env must exist for TTL check');
    const env = Object.fromEntries(
      readFileSync(envPath, 'utf8')
        .split('\n')
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => {
          const i = l.indexOf('=');
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
    );
    const ttl = parseInt(env.JITSI_JWT_TTL_SECONDS || '14400', 10);
    assert.equal(ttl, 14400);
    assert.equal(ttl / 60, 240);
    assert.notEqual(ttl, 600);
  });

  it('exposes interrupted status and live-session helpers', () => {
    assert.equal(VIDEO_CONNECTION_STATUS.interrupted.id, 'interrupted');
    assert.equal(isLiveVideoConnectionStatus('interrupted'), true);
    assert.equal(isLiveVideoConnectionStatus('reconnecting'), true);
    assert.equal(isLiveVideoConnectionStatus('left'), false);
    assert.equal(isLiveVideoConnectionStatus('idle'), false);
  });

  it('treats network flaps as transient; never auto-unrecoverable', () => {
    assert.equal(isTransientVideoError('connection.ICE_FAILED'), true);
    assert.equal(isTransientVideoError('conference.destroyed'), true);
    assert.equal(isAuthVideoError('jwt expired'), true);
    assert.equal(isTransientVideoError('jwt expired'), false);
    assert.equal(isUnrecoverableVideoFailure('anything'), false);
  });

  it('embed keeps unexpected leave out of endSession', () => {
    const embed = readFileSync(
      join(root, 'src/components/video/JitsiLessonEmbed.jsx'),
      'utf8',
    );
    const layer = readFileSync(
      join(root, 'src/components/video/VideoSessionLayer.jsx'),
      'utf8',
    );
    const ctx = readFileSync(
      join(root, 'src/lib/VideoSessionContext.jsx'),
      'utf8',
    );
    assert.match(embed, /intentionalLeaveRef/);
    assert.match(embed, /onUnexpectedLeave/);
    assert.match(embed, /markIntentionalLeave/);
    assert.match(embed, /effectGenRef|stillCurrent/);
    assert.match(layer, /softRemountConference/);
    assert.match(layer, /detail\?\.intentional/);
    assert.doesNotMatch(layer, /onLeft=\{\(\) => endSession\(\)\}/);
    assert.match(ctx, /softRemountConference/);
    assert.match(ctx, /everConnectedRef/);
    assert.match(ctx, /JITSI_JWT_TTL_SECONDS=14400|14400/);
  });
});
