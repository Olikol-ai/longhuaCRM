import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('password visibility toggle', () => {
  it('PasswordInput is the shared visibility control', () => {
    const input = read('src/design-system/primitives/Input.jsx');
    assert.match(input, /function DsPasswordInput|PasswordInput/);
    assert.match(input, /Показать пароль/);
    assert.match(input, /Скрыть пароль/);
    assert.match(input, /setSelectionRange/);
    assert.match(input, /min-h-11 min-w-11/);
    assert.match(input, /password-visibility-toggle/);
    assert.match(input, /aria-pressed/);
  });

  it('login, reset, settings and E2EE unlock use PasswordInput', () => {
    const files = [
      'src/pages/Login.jsx',
      'src/pages/ResetPassword.jsx',
      'src/components/settings/ChangePasswordSection.jsx',
      'src/components/chats/E2eeUnlockDialog.jsx',
    ];
    for (const rel of files) {
      const src = read(rel);
      assert.match(src, /PasswordInput/, rel);
      assert.doesNotMatch(src, /type="password"/, rel);
    }
  });
});
