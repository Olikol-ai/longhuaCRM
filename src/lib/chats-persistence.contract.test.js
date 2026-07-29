import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('Chat message persistence', () => {
  it('backend list uses entity property paths (not raw DB columns)', () => {
    const service = readFileSync(
      join(root, 'apps/api/src/modules/chats/services/chat-messages.service.ts'),
      'utf8',
    );
    assert.match(service, /message\.chatId/);
    assert.match(service, /message\.deletedAt/);
    assert.match(service, /message\.createdAt/);
    assert.doesNotMatch(service, /message\.chat_id/);
    assert.doesNotMatch(service, /message\.deleted_at/);
    assert.match(service, /emitMessageCreated/);
    assert.match(service, /notifyOfflineMembers/);
  });

  it('frontend loads history from REST and normalizes API fields', () => {
    const page = readFileSync(join(root, 'src/pages/Chats.jsx'), 'utf8');
    assert.match(page, /chatsApi\.messages/);
    assert.match(page, /normalizeMessage/);
    assert.match(page, /before:\s*oldest\.id/);
    assert.doesNotMatch(page, /localStorage.*messages/);
  });

  it('composer persists via HTTP before relying on UI state', () => {
    const composer = readFileSync(
      join(root, 'src/components/chats/ChatComposer.jsx'),
      'utf8',
    );
    assert.match(composer, /chatsApi\.sendMessage/);
    assert.match(composer, /onMessageCreated\(message\)/);
  });
});
