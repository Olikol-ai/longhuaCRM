import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isActiveInvite, inviteUrlFromRow } from '../lib/invite-links.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('invite links public URL contract', () => {
  it('builds share URL from invite id (stable public ref)', () => {
    const prev = globalThis.window;
    globalThis.window = { location: { origin: 'https://crm.example' } };
    try {
      assert.equal(
        inviteUrlFromRow({ id: 'abc-123' }),
        'https://crm.example/register?ref=abc-123',
      );
    } finally {
      globalThis.window = prev;
    }
  });

  it('treats camelCase and snake_case expiry fields as active', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    assert.equal(isActiveInvite({ id: '1', expires_at: future }), true);
    assert.equal(isActiveInvite({ id: '1', expiresAt: future }), true);
    assert.equal(isActiveInvite({ id: '1', expires_at: future, revoked_at: future }), false);
  });

  it('Profile and dashboards use idempotent ensure, not append-only create', () => {
    const profile = readFileSync(join(__dirname, '../pages/Profile.jsx'), 'utf8');
    assert.match(profile, /inviteUrlFromRow/);
    assert.match(profile, /Скопировать ссылку/);
    assert.doesNotMatch(profile, /sessionStorage\.setItem\(inviteStorageKey/);

    const dashboard = readFileSync(join(__dirname, '../pages/TeacherDashboard.jsx'), 'utf8');
    assert.match(dashboard, /handleEnsureInvite|teacherInvites\.create/);
    assert.match(dashboard, /setInvites\(inviteRows\)/);
    assert.match(dashboard, /Скопировать ссылку/);

    const tutor = readFileSync(join(__dirname, '../pages/TutorReferralLinks.jsx'), 'utf8');
    assert.match(tutor, /tutorInviteLinks\.create/);
    assert.match(tutor, /setInvites\(list\)/);
  });
});
