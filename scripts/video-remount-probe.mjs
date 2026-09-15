import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'https://lk.longhuachinese.online';
const LESSON_ID = fs.readFileSync('/tmp/video-verify-lesson.id', 'utf8').trim();
const TEACHER_JWT = fs.readFileSync('/tmp/teacher.jwt.live', 'utf8').trim();

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const ctx = await browser.newContext({
  permissions: ['camera', 'microphone'],
  viewport: { width: 1280, height: 800 },
});
await ctx.grantPermissions(['camera', 'microphone'], { origin: BASE });
const page = await ctx.newPage();
await page.addInitScript((t) => {
  localStorage.setItem('longhua_access_token', t);
  window.__remountLog = [];
  const push = (row) => {
    window.__remountLog.push({ ...row, t: new Date().toISOString() });
    if (window.__remountLog.length > 80) window.__remountLog.shift();
  };
  // Patch console.log path used by videoDiag if it logs
  const orig = console.info?.bind(console) || console.log.bind(console);
  console.info = (...args) => {
    const s = args.map(String).join(' ');
    if (s.includes('jitsi_api_dispose') || s.includes('connect_start') || s.includes('jitsi_api_created')) {
      push({ kind: 'console', s: s.slice(0, 200), stack: new Error().stack?.split('\n').slice(0, 8).join(' | ') });
    }
    return orig(...args);
  };
  console.log = (...args) => {
    const s = args.map(String).join(' ');
    if (s.includes('[video-diag]')) {
      push({ kind: 'log', s: s.slice(0, 220) });
    }
    return orig(...args);
  };
}, TEACHER_JWT);

page.on('console', (m) => {
  const t = m.text();
  if (t.includes('video-diag') || t.includes('ERR_') || m.type() === 'error') {
    // keep
  }
});

await page.goto(`${BASE}/lesson/${LESSON_ID}/video`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(3000);
const btn = page.getByRole('button', { name: /Начать урок/i }).first();
await btn.waitFor({ timeout: 60000 });
await btn.click();
await page.waitForTimeout(8000);

const snap = await page.evaluate(() => {
  let diag = [];
  try { diag = JSON.parse(sessionStorage.getItem('longhua_video_diag') || '[]'); } catch {}
  const types = diag.map((d) => d.type);
  const counts = types.reduce((a, t) => ((a[t] = (a[t] || 0) + 1), a), {});
  return {
    path: location.pathname,
    bodyHead: (document.body?.innerText || '').slice(0, 500),
    iframe: document.querySelectorAll('iframe').length,
    connection: document.querySelector('[data-testid="lesson-video-connection"]')?.textContent || null,
    jitsiHost: Boolean(document.querySelector('[data-testid="lesson-video-jitsi-host"]')),
    jitsiWrap: Boolean(document.querySelector('[data-testid="lesson-video-jitsi-wrap"]')),
    sessionFull: Boolean(document.querySelector('[data-testid="lesson-video-session-full"]')),
    counts,
    last10: diag.slice(-10),
    remountLog: (window.__remountLog || []).slice(-20),
  };
});
fs.writeFileSync('/tmp/video-remount-probe.json', JSON.stringify(snap, null, 2));
console.log(JSON.stringify(snap, null, 2));
await page.screenshot({ path: '/tmp/video-remount-probe.png', fullPage: true });
await browser.close();
