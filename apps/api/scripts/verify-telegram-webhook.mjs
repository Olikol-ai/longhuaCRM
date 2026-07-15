/**
 * Operational verification for Telegram webhook mode.
 * Usage (from repo root or apps/api):
 *   node apps/api/scripts/verify-telegram-webhook.mjs
 *
 * Reads TELEGRAM_* from process env / nearby .env files (never prints secrets).
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const roots = [
  resolve(__dirname, '../../..'),
  resolve(__dirname, '../..'),
  process.cwd(),
];

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = {
  ...loadEnvFile(resolve(roots[0], '.env')),
  ...loadEnvFile(resolve(roots[1], '.env')),
  ...process.env,
};

const token = (env.TELEGRAM_BOT_TOKEN || '').trim();
const expectedUrl = (env.TELEGRAM_WEBHOOK_URL || '').trim()
  || 'https://lk.longhuachinese.online/api/telegram/webhook';
const secret = (env.TELEGRAM_WEBHOOK_SECRET || '').trim();
const publicBase = 'https://lk.longhuachinese.online';

const report = [];
let failed = 0;

function pass(name, detail = '') {
  report.push({ status: 'PASS', name, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failed += 1;
  report.push({ status: 'FAIL', name, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

function warn(name, detail = '') {
  report.push({ status: 'WARN', name, detail });
  console.warn(`WARN  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { res, json, text };
}

if (!token) {
  fail('bot_token', 'TELEGRAM_BOT_TOKEN missing');
  process.exit(1);
}

console.log('Telegram webhook verification');
console.log(`Expected URL: ${expectedUrl}`);
console.log('');

// 1) Config sanity
if ((env.TELEGRAM_MODE || '').trim().toLowerCase() === 'webhook') {
  pass('env_mode', 'TELEGRAM_MODE=webhook');
} else {
  fail('env_mode', `TELEGRAM_MODE=${env.TELEGRAM_MODE || '(unset)'} (need webhook for tunnel)`);
}

if (expectedUrl.startsWith('https://lk.longhuachinese.online')) {
  pass('env_webhook_url_host', expectedUrl);
} else {
  fail('env_webhook_url_host', expectedUrl);
}

if (secret) {
  pass('env_webhook_secret', 'configured');
} else {
  warn('env_webhook_secret', 'empty — Telegram secret header not enforced');
}

// 2) Telegram getWebhookInfo
const info = await fetchJson(`https://api.telegram.org/bot${token}/getWebhookInfo`);
if (!info.json?.ok) {
  fail('telegram_getWebhookInfo', JSON.stringify(info.json));
} else {
  const url = info.json.result?.url || '';
  const pending = info.json.result?.pending_update_count;
  const lastError = info.json.result?.last_error_message;
  if (url === expectedUrl) {
    pass('telegram_webhook_registered', `url matches, pending=${pending}`);
  } else if (!url) {
    fail('telegram_webhook_registered', 'Telegram has empty webhook url');
  } else {
    fail('telegram_webhook_registered', `Telegram url=${url}`);
  }
  if (lastError) {
    warn('telegram_last_error', lastError);
  } else {
    pass('telegram_no_last_error');
  }
}

// 3) Public health
const health = await fetchJson(`${publicBase}/api/health`);
if (health.res.status === 200 && health.json?.ok) {
  pass('public_health', `uptime=${health.json.uptime_seconds}s db=${health.json.database}`);
} else {
  fail('public_health', `status=${health.res.status}`);
}

// 4) Webhook HTTP status + handler OK
const updateId = 910000000 + Math.floor(Math.random() * 100000);
const payload = {
  update_id: updateId,
  message: {
    message_id: 1,
    date: Math.floor(Date.now() / 1000),
    chat: { id: 1, type: 'private' },
    from: { id: 1, is_bot: false, first_name: 'Verify' },
    text: '/start',
  },
};
const headers = { 'Content-Type': 'application/json' };
if (secret) headers['x-telegram-bot-api-secret-token'] = secret;

const first = await fetchJson(`${publicBase}/api/telegram/webhook`, {
  method: 'POST',
  headers,
  body: JSON.stringify(payload),
});
if (first.res.status === 200 && first.json?.ok === true) {
  pass('webhook_http_200', JSON.stringify(first.json));
} else {
  fail('webhook_http_200', `status=${first.res.status} body=${first.text}`);
}

// callback_query shape
const cbPayload = {
  update_id: updateId + 1,
  callback_query: {
    id: 'verify-cb-1',
    from: { id: 1, is_bot: false, first_name: 'Verify' },
    chat_instance: '1',
    data: 'menu:main',
    message: {
      message_id: 2,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 1, type: 'private' },
      text: 'menu',
    },
  },
};
const cb = await fetchJson(`${publicBase}/api/telegram/webhook`, {
  method: 'POST',
  headers,
  body: JSON.stringify(cbPayload),
});
if (cb.res.status === 200 && cb.json?.ok === true) {
  pass('webhook_callback_query_accepted', JSON.stringify(cb.json));
} else {
  fail('webhook_callback_query_accepted', `status=${cb.res.status} body=${cb.text}`);
}

// duplicate update
const dup = await fetchJson(`${publicBase}/api/telegram/webhook`, {
  method: 'POST',
  headers,
  body: JSON.stringify(payload),
});
if (dup.res.status === 200 && dup.json?.ok === true) {
  pass('webhook_duplicate_returns_ok', 'second delivery still HTTP 200');
} else {
  fail('webhook_duplicate_returns_ok', `status=${dup.res.status}`);
}

if (secret) {
  const bad = await fetchJson(`${publicBase}/api/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ update_id: updateId + 2, message: payload.message }),
  });
  if (bad.res.status === 401 || bad.res.status === 403) {
    pass('webhook_secret_rejected', `status=${bad.res.status}`);
  } else {
    fail('webhook_secret_rejected', `expected 401/403 got ${bad.res.status}`);
  }
}

console.log('');
console.log(`Result: ${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
