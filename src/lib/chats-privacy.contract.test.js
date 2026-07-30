import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('Chats privacy and DM requests', () => {
  it('uses DM requests instead of auto-create direct chats', () => {
    const api = readFileSync(join(root, 'src/api/chats.api.js'), 'utf8');
    assert.match(api, /createDmRequest/);
    assert.match(api, /dm-requests/);
    assert.doesNotMatch(api, /createDirect/);
    assert.match(api, /hideMembership/);
    assert.match(api, /getPrivacy/);
    assert.match(api, /listBlocks/);
  });

  it('FindInterlocutorDialog sends request not createDirect', () => {
    const dialog = readFileSync(
      join(root, 'src/components/chats/FindInterlocutorDialog.jsx'),
      'utf8',
    );
    assert.match(dialog, /Отправить запрос/);
    assert.match(dialog, /createDmRequest/);
    assert.match(dialog, /selectedId/);
    assert.match(dialog, /Запрос на переписку отправлен/);
    assert.match(dialog, /userFacingError/);
    assert.doesNotMatch(dialog, /createDirect/);
    assert.doesNotMatch(dialog, /disabled=\{!canRequest/);
  });

  it('Settings exposes privacy policy and block list', () => {
    const settings = readFileSync(join(root, 'src/pages/Settings.jsx'), 'utf8');
    assert.match(settings, /Приватность/);
    assert.match(settings, /Чёрный список/);
    assert.match(settings, /updatePrivacy/);
    assert.match(settings, /blockUser/);
  });

  it('socket client listens for dotted event names', () => {
    const page = readFileSync(join(root, 'src/pages/Chats.jsx'), 'utf8');
    assert.match(page, /message\.created/);
    assert.match(page, /user\.online/);
    assert.match(page, /chat\.request\.created/);
  });
});
