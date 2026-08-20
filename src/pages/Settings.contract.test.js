import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRoleLabel } from '../lib/locale-by.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Settings role display', () => {
  it('maps tutor to Репетитор via getRoleLabel', () => {
    assert.equal(getRoleLabel('tutor'), 'Репетитор');
    assert.equal(getRoleLabel('admin'), 'Администратор');
    assert.equal(getRoleLabel('teacher'), 'Преподаватель');
    assert.equal(getRoleLabel('student'), 'Ученик');
    assert.equal(getRoleLabel('tutor_student'), 'Ученик репетитора');
  });

  it('Settings page uses getRoleLabel and never falls back to raw role keys', () => {
    const source = readFileSync(join(__dirname, 'Settings.jsx'), 'utf8');
    assert.match(source, /getRoleLabel/);
    assert.match(source, /settings-role-label/);
    assert.match(source, /settings-role-badge/);
    // Must not fall back to user.role in JSX display (shows "tutor" raw).
    assert.doesNotMatch(source, /roleLabel\[user\.role\]\s*\|\|\s*user\.role/);
    assert.doesNotMatch(source, /roleLabel\[user\.role\]\s*\|\|\s*["']—["']/);
    // UUID only for admin technical section.
    assert.match(source, /isAdmin &&/);
    assert.match(source, /Техническая информация/);
    // Avatar UI is theme-agnostic (no dark/light-only avatar markup).
    assert.match(source, /AvatarEditor/);
    assert.doesNotMatch(source, /bg-gradient-to-br from-primary to-brand-active/);
  });

  it('Settings wraps long emails and values without horizontal overflow', () => {
    const source = readFileSync(join(__dirname, 'Settings.jsx'), 'utf8');
    assert.match(source, /overflow-x-hidden/);
    assert.match(source, /min-w-0/);
    assert.match(source, /overflow-wrap:anywhere|\[overflow-wrap:anywhere\]/);
    assert.match(source, /settings-email/);
    assert.match(source, /break-words/);
    assert.doesNotMatch(source, /truncate.*email|email.*truncate/);
  });

  it('Settings profile header stacks identity below avatar actions on mobile', () => {
    const source = readFileSync(join(__dirname, 'Settings.jsx'), 'utf8');
    assert.match(source, /settings-profile-header/);
    assert.match(source, /flex flex-col md:flex-row/);
    assert.match(source, /stretchActions/);
    assert.match(source, /rounded-full/);
    assert.match(source, /text-xl md:text-base/);
    const editor = readFileSync(
      join(__dirname, '..', 'components', 'user', 'AvatarEditor.jsx'),
      'utf8',
    );
    assert.match(editor, /stretchActions/);
    assert.match(editor, /flex-1/);
    assert.match(editor, /w-full/);
  });

  it('Settings includes change-password security section', () => {
    const source = readFileSync(join(__dirname, 'Settings.jsx'), 'utf8');
    assert.match(source, /ChangePasswordSection/);
    assert.match(source, /settings-change-password|ChangePasswordSection/);
    const section = readFileSync(
      join(__dirname, '..', 'components', 'settings', 'ChangePasswordSection.jsx'),
      'utf8',
    );
    assert.match(section, /changePassword/);
    assert.match(section, /rewrapWithNewPassword/);
    assert.match(section, /PasswordInput/);
    assert.match(section, /Текущий пароль/);
    assert.match(section, /Новый пароль/);
    assert.match(section, /Повторите новый пароль/);
    assert.match(section, /Изменить пароль/);
    assert.match(section, /REGISTRATION_PASSWORD_HINT/);
    const passwordInput = readFileSync(
      join(__dirname, '..', 'design-system', 'primitives', 'Input.jsx'),
      'utf8',
    );
    assert.match(passwordInput, /Показать пароль/);
    assert.match(passwordInput, /EyeOff/);
  });
});
