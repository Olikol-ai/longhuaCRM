import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function readSrc(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

/** Mirrors the user-facing generic message shown after forgot-password submit. */
const GENERIC_FORGOT_MESSAGE =
  'Если такой email зарегистрирован, на него отправлена ссылка для восстановления пароля.';

describe('forgot password UI contracts', () => {
  it('login page shows "Забыли пароль?" link to /forgot-password', () => {
    const login = readSrc('src/pages/Login.jsx');
    assert.match(login, /Забыли пароль\?/);
    assert.match(login, /to="\/forgot-password"/);
    assert.match(login, /data-testid="forgot-password-link"/);
  });

  it('App registers public forgot and reset routes', () => {
    const app = readSrc('src/App.jsx');
    assert.match(app, /path="\/forgot-password"/);
    assert.match(app, /path="\/reset-password"/);
    assert.match(app, /ForgotPassword/);
    assert.match(app, /ResetPassword/);
  });

  it('forgot-password form submits email via auth API and shows generic success', () => {
    const page = readSrc('src/pages/ForgotPassword.jsx');
    const auth = readSrc('src/api/auth.js');

    assert.match(page, /Восстановление пароля/);
    assert.match(page, /Отправить ссылку/);
    assert.match(page, /api\.auth\.forgotPassword/);
    assert.ok(page.includes(GENERIC_FORGOT_MESSAGE));
    assert.equal(GENERIC_FORGOT_MESSAGE.includes('существует'), false);

    assert.match(auth, /forgotPassword\(email\)/);
    assert.match(auth, /\/auth\/forgot-password/);
  });

  it('reset-password page reads token from query and posts reset', () => {
    const page = readSrc('src/pages/ResetPassword.jsx');
    const auth = readSrc('src/api/auth.js');

    assert.match(page, /useSearchParams/);
    assert.match(page, /searchParams\.get\('token'\)/);
    assert.match(page, /data-testid="reset-password-missing-token"/);
    assert.match(page, /data-testid="reset-password-form"/);
    assert.match(page, /data-testid="reset-password-token"/);
    assert.match(page, /api\.auth\.resetPassword/);
    assert.match(auth, /resetPassword\(token, password, confirmPassword\)/);
    assert.match(auth, /\/auth\/reset-password/);
    assert.match(auth, /confirm_password/);
  });
});
