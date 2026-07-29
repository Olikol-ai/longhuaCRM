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

  it('Settings source does not hardcode incomplete role maps missing tutor', () => {
    const source = readFileSync(join(__dirname, 'Settings.jsx'), 'utf8');
    assert.doesNotMatch(
      source,
      /roleLabel\s*=\s*\{\s*admin:\s*["']Администратор["'],\s*teacher:/,
    );
  });
});
