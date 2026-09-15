import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('Admin Balance page contract', () => {
  it('registers admin Balance nav after Schedule and wires API', () => {
    const layout = readFileSync(join(root, 'src/Layout.jsx'), 'utf8');
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8');
    const routing = readFileSync(join(root, 'src/lib/routing.js'), 'utf8');
    const page = readFileSync(join(root, 'src/pages/Balance.jsx'), 'utf8');
    const api = readFileSync(join(root, 'src/api/balances.api.js'), 'utf8');

    assert.match(layout, /page: "Balance"/);
    assert.match(layout, /name: "Баланс"/);
    assert.match(app, /path="\/Balance"/);
    assert.match(routing, /'\/Balance': \['admin'\]/);
    assert.match(page, /api\.balances\.list/);
    assert.match(page, /api\.balances\.detail/);
    assert.match(page, /historical_lessons_credit|Исторический кредит/);
    assert.match(page, /adjustLessons|Корректировка остатка/);
    assert.match(page, /formatBYN/);
    assert.doesNotMatch(page, /BYN BYN|formatBYN\([^)]+\)\s*\+\s*['\"]BYN/);
    assert.match(api, /\/admin\/balances/);
    assert.match(api, /adjust-lessons/);
  });
});
