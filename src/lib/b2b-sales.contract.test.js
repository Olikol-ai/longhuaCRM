import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('B2B sales routing contract', () => {
  it('registers sales_manager dashboard and admin B2B hub routes', () => {
    const routing = readFileSync(join(root, 'src/lib/routing.js'), 'utf8');
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8');
    const layout = readFileSync(join(root, 'src/Layout.jsx'), 'utf8');

    assert.match(routing, /sales_manager:\s*'\/sales-manager'/);
    assert.match(routing, /sales_manager:\s*'\/SalesManagerDashboard'/);
    assert.match(routing, /'\/B2bSales':\s*\['admin'\]/);
    assert.match(routing, /'\/SalesManagerDashboard':\s*\['admin',\s*'sales_manager'\]/);
    assert.match(routing, /'\/SalesDiary':\s*\['admin',\s*'sales_manager'\]/);
    assert.match(app, /B2bSalesHub/);
    assert.match(app, /SalesManagerDashboard/);
    assert.match(app, /SalesDiary/);
    assert.match(layout, /B2bSales/);
    assert.match(layout, /SalesDiary/);
    assert.match(layout, /salesManagerNav/);
  });

  it('includes sales_manager in auth gate valid roles', () => {
    const authGate = readFileSync(join(root, 'src/lib/auth-gate.jsx'), 'utf8');
    assert.match(authGate, /'sales_manager'/);
  });
});
