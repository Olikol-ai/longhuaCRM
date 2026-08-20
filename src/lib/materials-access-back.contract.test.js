import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('materials access back navigation', () => {
  it('opens access mode one-way and exits via Back', () => {
    const manager = read('src/components/materials/MaterialManager.jsx');
    assert.match(manager, /materials-access-back/);
    assert.match(manager, /Назад/);
    assert.match(manager, /setView\('users-access'\)/);
    assert.match(manager, /setView\('library'\)/);
    assert.doesNotMatch(
      manager,
      /setView\(view === 'users-access' \? 'library' : 'users-access'\)/,
    );
  });
});
