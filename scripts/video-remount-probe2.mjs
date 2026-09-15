import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'https://lk.longhuachinese.online';
const LESSON_ID = fs.readFileSync('/tmp/video-verify-lesson.id', 'utf8').trim();
const TEACHER_JWT = fs.readFileSync('/tmp/teacher.jwt.live', 'utf8').trim();

const browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ permissions:['camera','microphone'], viewport:{width:1280,height:800}});
await ctx.grantPermissions(['camera','microphone'], { origin: BASE });
const page = await ctx.newPage();
await page.addInitScript((t) => {
  localStorage.setItem('longhua_access_token', t);
  window.__hooks = { mount: 0, unmount: 0, keys: [], statuses: [] };
  const obs = new MutationObserver(() => {
    const wrap = document.querySelector('[data-testid="lesson-video-jitsi-wrap"]');
    const host = document.querySelector('[data-testid="lesson-video-jitsi-host"]');
    const full = document.querySelector('[data-testid="lesson-video-session-full"]');
    const pill = document.querySelector('[data-testid="lesson-video-connection"]')?.textContent;
    window.__hooks.statuses.push({
      t: Date.now(),
      wrap: Boolean(wrap),
      host: Boolean(host),
      full: Boolean(full),
      pill,
      iframe: document.querySelectorAll('iframe').length,
    });
    if (window.__hooks.statuses.length > 200) window.__hooks.statuses.shift();
  });
  const start = () => {
    if (document.body) obs.observe(document.body, { childList:true, subtree:true });
    else setTimeout(start, 50);
  };
  start();
}, TEACHER_JWT);

await page.goto(`${BASE}/lesson/${LESSON_ID}/video`, { waitUntil:'domcontentloaded', timeout:90000 });
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /Начать урок/i }).first().click();

// Poll for 12s
const samples = [];
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => {
    let diag=[]; try{diag=JSON.parse(sessionStorage.getItem('longhua_video_diag')||'[]');}catch{}
    const created = diag.filter(d=>d.type==='jitsi_api_created').length;
    const disposed = diag.filter(d=>d.type==='jitsi_api_dispose').length;
    const joined = diag.filter(d=>d.type==='conference_joined').length;
    // try read react fiber key from jitsi wrap
    const wrap = document.querySelector('[data-testid="lesson-video-jitsi-wrap"]');
    let fiberKey = null;
    if (wrap) {
      const fk = Object.keys(wrap).find(k=>k.startsWith('__reactFiber')||k.startsWith('__reactInternalInstance'));
      let fiber = fk ? wrap[fk] : null;
      // walk up for key
      for (let i=0;i<12 && fiber;i++) {
        if (fiber.key != null) { fiberKey = fiber.key; break; }
        fiber = fiber.return;
      }
    }
    return {
      created, disposed, joined,
      fiberKey,
      pill: document.querySelector('[data-testid="lesson-video-connection"]')?.textContent||null,
      iframe: document.querySelectorAll('iframe').length,
      full: Boolean(document.querySelector('[data-testid="lesson-video-session-full"]')),
      mut: (window.__hooks?.statuses||[]).slice(-3),
    };
  });
  samples.push(s);
  process.stdout.write(`${i}: created=${s.created} disposed=${s.disposed} key=${s.fiberKey} pill=${s.pill} iframe=${s.iframe}\n`);
}
fs.writeFileSync('/tmp/video-remount-probe2.json', JSON.stringify(samples, null, 2));
await browser.close();
