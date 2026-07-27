import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Profile self-edit', () => {
  it('exposes edit button, editable FIO, save via auth.updateMe full_name', () => {
    const source = readFileSync(join(__dirname, 'Profile.jsx'), 'utf8');
    assert.match(source, /profile-edit-button/);
    assert.match(source, /Редактировать профиль/);
    assert.match(source, /profile-full-name/);
    assert.match(source, /profile-save-button/);
    assert.match(source, /api\.auth\.updateMe/);
    assert.match(source, /full_name:\s*fullName/);
    assert.match(source, /checkAppState\(\{\s*force:\s*true\s*\}\)/);
    assert.match(source, /Профиль обновлён/);
    assert.match(source, /минимум два слова/);
    assert.match(source, /isValidBelarusPhone/);
  });

  it('Settings links to Profile for editing personal data', () => {
    const source = readFileSync(join(__dirname, 'Settings.jsx'), 'utf8');
    assert.match(source, /settings-edit-profile/);
    assert.match(source, /Редактировать профиль/);
    assert.match(source, /createPageUrl\(["']Profile["']\)/);
  });
});
