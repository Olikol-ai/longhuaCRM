import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BYN_CODE, formatBYN, formatCurrency, parseMoneyAmount } from './money.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

function currencyOccurrences(text) {
  const matches = String(text).match(/\bBYN\b/g);
  return matches ? matches.length : 0;
}

describe('formatBYN canonical display', () => {
  it('formats 100 with a single BYN', () => {
    const out = formatBYN(100);
    assert.equal(currencyOccurrences(out), 1);
    assert.match(out, /100/);
    assert.match(out, /BYN$/);
    assert.doesNotMatch(out, /BYN\s+BYN/);
  });

  it('formats 100.5 with a single BYN and two decimals', () => {
    const out = formatBYN(100.5);
    assert.equal(currencyOccurrences(out), 1);
    assert.match(out, /100,50/);
    assert.doesNotMatch(out, /BYN\s+BYN/);
  });

  it('formats 0 with a single BYN', () => {
    const out = formatBYN(0);
    assert.equal(out, `0 ${BYN_CODE}`);
    assert.equal(currencyOccurrences(out), 1);
  });

  it('formats negative values with a single BYN', () => {
    const out = formatBYN(-100);
    assert.equal(currencyOccurrences(out), 1);
    assert.match(out, /100/);
    assert.doesNotMatch(out, /BYN\s+BYN/);
  });

  it('null / undefined / NaN become 0 BYN, never NaN BYN', () => {
    assert.equal(formatBYN(null), '0 BYN');
    assert.equal(formatBYN(undefined), '0 BYN');
    assert.equal(formatBYN(''), '0 BYN');
    assert.equal(formatBYN(Number.NaN), '0 BYN');
    assert.doesNotMatch(formatBYN('abc'), /NaN/);
    assert.equal(parseMoneyAmount(undefined), 0);
  });

  it('formatCurrency is an alias of formatBYN', () => {
    assert.equal(formatCurrency(1500), formatBYN(1500));
  });

  it('hourly rate is amount + one BYN + /ч', () => {
    const out = `${formatBYN(40)}/ч`;
    assert.equal(currencyOccurrences(out), 1);
    assert.match(out, /BYN\/ч$/);
    const formatters = read('lib/formatters.js');
    assert.match(formatters, /formatBYN\(value\)\}?\/ч/);
  });
});

describe('money UI must not double-suffix BYN', () => {
  const files = [
    'pages/Payments.jsx',
    'pages/PaymentReturn.jsx',
    'pages/StudentDetail.jsx',
    'pages/Salary.jsx',
    'pages/Analytics.jsx',
    'pages/TeacherDashboard.jsx',
    'pages/ShopSettingsAdmin.jsx',
    'components/student/TopUpModal.jsx',
    'components/payments/PaymentModal.jsx',
  ];

  it('never concatenates formatter output with another BYN', () => {
    for (const rel of files) {
      const src = read(rel);
      assert.doesNotMatch(
        src,
        /format(BYN|Currency|MoneyByn|CurrencyAmount)\([^)]*\)\s*[}`'"]?\s*\{[^}]*currency/,
        `${rel} must not append payment.currency after formatter`,
      );
      assert.doesNotMatch(
        src,
        /format(BYN|Currency|MoneyByn)\([^)]*\)\s*\{[^}]*\|\|\s*["']BYN["']/,
        `${rel} must not append || "BYN" after formatter`,
      );
      assert.doesNotMatch(src, /BYN BYN/, `${rel} must not hardcode BYN BYN`);
      assert.doesNotMatch(src, /\$\{p\.amount\}/, `${rel} must not use dollar prefix`);
    }
  });

  it('Payments and PaymentReturn use formatBYN without extra currency', () => {
    const payments = read('pages/Payments.jsx');
    const ret = read('pages/PaymentReturn.jsx');
    assert.match(payments, /formatBYN/);
    assert.doesNotMatch(payments, /formatCurrency\(payment\.amount\)\s*\{payment\.currency/);
    assert.match(ret, /formatBYN/);
    assert.doesNotMatch(ret, /result\.currency \|\| ['"]BYN['"]/);
  });
});
