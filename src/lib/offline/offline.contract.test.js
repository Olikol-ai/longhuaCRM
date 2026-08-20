import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_STORES,
  OFFLINE_RESOURCES,
  CHAT_MESSAGE_CAP,
  OFFLINE_MUTATION_MESSAGE,
  buildOfflineKey,
  createSnapshotRecord,
  isSnapshotExpired,
  sanitizeForOffline,
  sanitizeChatMessages,
  sanitizeMaterialMetaList,
  stripAuthFromUrl,
  setOfflineBackend,
  createMemoryOfflineBackend,
  resetOfflineDbConnection,
  putSnapshot,
  getSnapshot,
  clearOfflineDataForUser,
  clearAllOfflineData,
  ensureOfflineUserScope,
  readWithOfflineFallback,
  formatOfflineUpdatedAt,
  isOfflineDataStale,
  OfflineMutationError,
  assertOnlineForMutation,
  isMutationMethod,
  resetOfflineNetworkStateForTests,
  markNetworkOffline,
  markNetworkOnline,
  isOfflineMode,
} from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');

describe('Offline IndexedDB layer (Stage 3)', () => {
  beforeEach(() => {
    resetOfflineDbConnection();
    setOfflineBackend(createMemoryOfflineBackend());
    resetOfflineNetworkStateForTests('online');
  });

  it('initializes named DB + stores constants', () => {
    assert.equal(OFFLINE_DB_NAME, 'longhua-offline');
    assert.equal(OFFLINE_DB_VERSION, 1);
    assert.ok(OFFLINE_STORES.includes('schedule'));
    assert.ok(OFFLINE_STORES.includes('chats'));
    assert.ok(OFFLINE_STORES.includes('materials'));
    assert.ok(OFFLINE_STORES.includes('homework'));
    assert.ok(OFFLINE_STORES.includes('profile'));
    assert.ok(OFFLINE_STORES.includes('balance'));
  });

  it('schema migration version is pinned', () => {
    assert.equal(OFFLINE_DB_VERSION, 1);
    const dbSrc = readFileSync(join(__dirname, 'offlineDb.js'), 'utf8');
    assert.match(dbSrc, /onupgradeneeded/);
    assert.match(dbSrc, /createObjectStore/);
  });

  it('write/read snapshot roundtrip', async () => {
    await putSnapshot({
      userId: 'u1',
      role: 'student',
      resource: OFFLINE_RESOURCES.SCHEDULE,
      data: { lessons: [{ id: 'l1' }] },
    });
    const snap = await getSnapshot({
      userId: 'u1',
      role: 'student',
      resource: OFFLINE_RESOURCES.SCHEDULE,
    });
    assert.equal(snap.data.lessons[0].id, 'l1');
    assert.ok(snap.updatedAt);
    assert.equal(snap.userId, 'u1');
  });

  it('TTL expires snapshots', async () => {
    const record = createSnapshotRecord({
      userId: 'u1',
      role: 'teacher',
      resource: OFFLINE_RESOURCES.HOMEWORK,
      data: { rows: [] },
      expiresAt: Date.now() - 1000,
    });
    assert.equal(isSnapshotExpired(record), true);

    await putSnapshot({
      userId: 'u1',
      role: 'teacher',
      resource: OFFLINE_RESOURCES.HOMEWORK,
      data: { rows: [1] },
      ttlMs: 1,
    });
    await new Promise((r) => setTimeout(r, 5));
    const snap = await getSnapshot({
      userId: 'u1',
      role: 'teacher',
      resource: OFFLINE_RESOURCES.HOMEWORK,
      allowExpired: false,
    });
    assert.equal(snap, null);
  });

  it('user isolation: keys scoped and cross-user get returns null', async () => {
    const key = buildOfflineKey('alice', 'teacher', OFFLINE_RESOURCES.CHATS_LIST);
    assert.match(key, /^alice::teacher::/);
    await putSnapshot({
      userId: 'alice',
      role: 'teacher',
      resource: OFFLINE_RESOURCES.CHATS_LIST,
      data: { groups: { direct: [{ id: 'c1' }] } },
    });
    const other = await getSnapshot({
      userId: 'bob',
      role: 'teacher',
      resource: OFFLINE_RESOURCES.CHATS_LIST,
    });
    assert.equal(other, null);
  });

  it('logout cleanup clears user data', async () => {
    await putSnapshot({
      userId: 'u1',
      role: 'student',
      resource: OFFLINE_RESOURCES.PROFILE,
      data: { id: 'u1' },
    });
    await clearOfflineDataForUser('u1');
    const snap = await getSnapshot({
      userId: 'u1',
      role: 'student',
      resource: OFFLINE_RESOURCES.PROFILE,
      allowExpired: true,
    });
    assert.equal(snap, null);
  });

  it('role isolation: same user different role does not share', async () => {
    await putSnapshot({
      userId: 'u1',
      role: 'teacher',
      resource: OFFLINE_RESOURCES.SCHEDULE,
      data: { lessons: ['t'] },
    });
    const asStudent = await getSnapshot({
      userId: 'u1',
      role: 'student',
      resource: OFFLINE_RESOURCES.SCHEDULE,
    });
    assert.equal(asStudent, null);
  });

  it('account switch clears previous offline cache', async () => {
    await putSnapshot({
      userId: 'old',
      role: 'admin',
      resource: OFFLINE_RESOURCES.SCHEDULE,
      data: { secret: true },
    });
    await ensureOfflineUserScope('old', 'admin');
    await ensureOfflineUserScope('new', 'teacher');
    const leaked = await getSnapshot({
      userId: 'old',
      role: 'admin',
      resource: OFFLINE_RESOURCES.SCHEDULE,
      allowExpired: true,
    });
    assert.equal(leaked, null);
  });

  it('sanitize strips access_token and JWT-like fields', () => {
    const cleaned = sanitizeForOffline({
      url: '/api/files?access_token=SECRET',
      authorization: 'Bearer abc',
      jwt: 'x.y.z',
      ok: 1,
    });
    assert.equal(cleaned.ok, 1);
    assert.equal(cleaned.authorization, undefined);
    assert.equal(cleaned.jwt, undefined);
    assert.match(cleaned.url, /REDACTED/);
    assert.equal(stripAuthFromUrl('https://x/?access_token=abc&v=1').includes('abc'), false);
  });

  it('materials metadata sanitizer drops binaries', () => {
    const rows = sanitizeMaterialMetaList([
      {
        id: 'm1',
        name: 'Doc',
        type: 'pdf',
        size: 12,
        file_url: '/uploads/x?access_token=tok',
        blob: 'huge',
      },
    ]);
    assert.equal(rows[0].id, 'm1');
    assert.equal(rows[0].blob, undefined);
    assert.equal(rows[0].file_url, undefined);
  });

  it('chat messages are capped', () => {
    const many = Array.from({ length: CHAT_MESSAGE_CAP + 20 }, (_, i) => ({
      id: i,
      body: `m${i}`,
      url: `https://x/?access_token=t${i}`,
    }));
    const capped = sanitizeChatMessages(many, CHAT_MESSAGE_CAP);
    assert.equal(capped.length, CHAT_MESSAGE_CAP);
    assert.match(capped[0].url, /REDACTED/);
  });

  it('stale data indicator helpers', () => {
    const now = Date.now();
    assert.match(formatOfflineUpdatedAt(now - 4 * 60000, now), /4 мин/);
    assert.equal(isOfflineDataStale(now - 2 * 60 * 60 * 1000, now), true);
  });

  it('offline → online refresh path via readWithOfflineFallback', async () => {
    let calls = 0;
    const first = await readWithOfflineFallback({
      userId: 'u1',
      role: 'student',
      resource: OFFLINE_RESOURCES.SCHEDULE,
      fetcher: async () => {
        calls += 1;
        return { lessons: [1] };
      },
    });
    assert.equal(first.fromCache, false);
    assert.equal(calls, 1);

    markNetworkOffline();
    const second = await readWithOfflineFallback({
      userId: 'u1',
      role: 'student',
      resource: OFFLINE_RESOURCES.SCHEDULE,
      fetcher: async () => {
        calls += 1;
        const err = new Error('failed to fetch');
        err.status = 0;
        throw err;
      },
    });
    assert.equal(second.fromCache, true);
    assert.deepEqual(second.data, { lessons: [1] });

    markNetworkOnline();
    const third = await readWithOfflineFallback({
      userId: 'u1',
      role: 'student',
      resource: OFFLINE_RESOURCES.SCHEDULE,
      fetcher: async () => {
        calls += 1;
        return { lessons: [2] };
      },
    });
    assert.equal(third.fromCache, false);
    assert.deepEqual(third.data, { lessons: [2] });
  });

  it('failed API falls back to snapshot', async () => {
    await putSnapshot({
      userId: 'u1',
      role: 'student',
      resource: OFFLINE_RESOURCES.HOMEWORK,
      data: { cards: ['cached'] },
    });
    const result = await readWithOfflineFallback({
      userId: 'u1',
      role: 'student',
      resource: OFFLINE_RESOURCES.HOMEWORK,
      fetcher: async () => {
        throw Object.assign(new Error('Network Error'), { status: 0 });
      },
    });
    assert.equal(result.fromCache, true);
    assert.deepEqual(result.data.cards, ['cached']);
  });

  it('blocks mutations while offline', () => {
    assert.equal(isMutationMethod('POST'), true);
    assert.equal(isMutationMethod('GET'), false);
    markNetworkOffline();
    assert.equal(isOfflineMode(), true);
    assert.throws(() => assertOnlineForMutation(), (err) => {
      assert.ok(err instanceof OfflineMutationError);
      assert.equal(err.message, OFFLINE_MUTATION_MESSAGE);
      return true;
    });
  });

  it('clearAllOfflineData empties stores', async () => {
    await putSnapshot({
      userId: 'a',
      role: 'admin',
      resource: OFFLINE_RESOURCES.BALANCE,
      data: { lesson_balance: 3 },
    });
    await clearAllOfflineData();
    const snap = await getSnapshot({
      userId: 'a',
      role: 'admin',
      resource: OFFLINE_RESOURCES.BALANCE,
      allowExpired: true,
    });
    assert.equal(snap, null);
  });
});

describe('Stage 3 wiring contracts', () => {
  it('Auth logout clears offline data', () => {
    const auth = readFileSync(join(root, 'src/lib/AuthContext.jsx'), 'utf8');
    assert.match(auth, /clearAllOfflineData/);
    assert.match(auth, /ensureOfflineUserScope/);
  });

  it('http blocks offline mutations and does not cache API in SW', () => {
    const http = readFileSync(join(root, 'src/api/http.js'), 'utf8');
    assert.match(http, /assertOnlineForMutation/);
    const sw = readFileSync(join(root, 'public/sw.js'), 'utf8');
    assert.match(sw, /isApiRequest/);
    assert.match(sw, /isSocketRequest/);
    assert.match(sw, /access_token/);
  });

  it('App mounts OfflineStatusController; VideoSession untouched by offline layer', () => {
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8');
    assert.match(app, /OfflineStatusController/);
    assert.match(app, /VideoSessionProvider/);
    const offlineIdx = readFileSync(join(root, 'src/lib/offline/index.js'), 'utf8');
    assert.doesNotMatch(offlineIdx, /VideoSession|Jitsi|PictureInPicture|PiP/i);
  });

  it('whitelist pages use offline read helper', () => {
    for (const rel of [
      'src/pages/TeacherSchedule.jsx',
      'src/pages/Schedule.jsx',
      'src/pages/StudentLessons.jsx',
      'src/pages/Chats.jsx',
      'src/pages/HomeworkList.jsx',
      'src/pages/HomeworkViewer.jsx',
      'src/components/materials/MaterialManager.jsx',
    ]) {
      const src = readFileSync(join(root, rel), 'utf8');
      assert.match(src, /readWithOfflineFallback/, rel);
    }
  });

  it('chats remain read-only offline (no outbox)', () => {
    const chats = readFileSync(join(root, 'src/pages/Chats.jsx'), 'utf8');
    assert.match(chats, /показаны последние сообщения/);
    assert.doesNotMatch(chats, /outbox/i);
    assert.doesNotMatch(chats, /localStorage.*messages/);
  });

  it('Document PiP contract still present and independent', () => {
    const pip = readFileSync(join(root, 'src/lib/document-picture-in-picture.contract.test.js'), 'utf8');
    assert.match(pip, /Picture-in-Picture|pictureInPicture|PiP/i);
  });
});
