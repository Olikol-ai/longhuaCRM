/**
 * Regression: node-pg truncates timestamptz to milliseconds.
 * Unread must compare (created_at, id) inside Postgres, never via JS Date params.
 */
describe('chat unread timestamp precision', () => {
  it('documents that truncated JS Date falsely counts the cursor message', () => {
    // Real DB values from Сообщество Longhua (admin last_read = latest message)
    const dbCreatedAtUs = '2026-07-30T20:36:02.722391Z';
    const jsDateIso = new Date(dbCreatedAtUs).toISOString(); // → …722Z
    expect(jsDateIso).toBe('2026-07-30T20:36:02.722Z');
    expect(jsDateIso).not.toBe(dbCreatedAtUs);

    // Truncated bound makes the cursor row itself satisfy created_at > :readAt
    const truncatedMs = Date.parse(jsDateIso);
    const fullApprox = Date.parse('2026-07-30T20:36:02.722Z') + 0.391;
    expect(fullApprox).toBeGreaterThan(truncatedMs);
  });

  it('countUnread SQL must use row subquery, not :readAt Date bind', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const src = fs.readFileSync(
      path.join(__dirname, 'services/chats.service.ts'),
      'utf8',
    );
    expect(src).toMatch(/\(message\.created_at, message\.id\) >/);
    expect(src).toMatch(/FROM chat_messages cursor/);
    // Old buggy pattern must stay gone from countUnread.
    expect(src).not.toMatch(
      /message\.createdAt > :readAt OR \(message\.createdAt = :readAt AND message\.id > :readId\)/,
    );
  });
});
