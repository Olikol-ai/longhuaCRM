import { chromium } from 'playwright';
import fs from 'fs';
const BASE='https://lk.longhuachinese.online';
const LESSON_ID=fs.readFileSync('/tmp/video-verify-lesson.id','utf8').trim();
const TEACHER_JWT=fs.readFileSync('/tmp/teacher.jwt.live','utf8').trim();

const browser = await chromium.launch({
  headless:true,
  args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({permissions:['camera','microphone'], viewport:{width:1280,height:800}})).newPage();
await page.context().grantPermissions(['camera','microphone'],{origin:BASE});
await page.addInitScript((t) => {
  localStorage.setItem('longhua_access_token', t);
  window.__flicker = [];
  const note = (why) => {
    const body = (document.body?.innerText||'').slice(0,120).replace(/\s+/g,' ');
    window.__flicker.push({
      t: new Date().toISOString(),
      why,
      body,
      sessionFull: !!document.querySelector('[data-testid="lesson-video-session-full"]'),
      pill: document.querySelector('[data-testid="lesson-video-connection"]')?.textContent||null,
      authLoading: /Загрузка сессии/i.test(document.body?.innerText||''),
      lessonLoading: /Загрузка урока/i.test(document.body?.innerText||''),
      iframe: document.querySelectorAll('iframe').length,
    });
    if (window.__flicker.length > 300) window.__flicker.shift();
  };
  const obs = new MutationObserver(() => note('mut'));
  const start = () => {
    if (!document.body) return setTimeout(start, 20);
    obs.observe(document.body, {childList:true, subtree:true, characterData:true});
    note('start');
  };
  start();
  // Patch setItem for token
  const _set = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (k,v) => {
    if (k === 'longhua_access_token') note('token_set:'+String(v).slice(-12));
    return _set(k,v);
  };
  const _remove = localStorage.removeItem.bind(localStorage);
  localStorage.removeItem = (k) => {
    if (k === 'longhua_access_token') note('token_remove');
    return _remove(k);
  };
}, TEACHER_JWT);

await page.goto(`${BASE}/lesson/${LESSON_ID}/video`, {waitUntil:'domcontentloaded', timeout:90000});
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /Начать урок/i }).first().click();
await page.waitForTimeout(15000);
const data = await page.evaluate(() => {
  let diag=[]; try{diag=JSON.parse(sessionStorage.getItem('longhua_video_diag')||'[]');}catch{}
  // compress flicker: only transitions of sessionFull/authLoading
  const f = window.__flicker || [];
  const transitions = [];
  let prev = null;
  for (const row of f) {
    const sig = `${row.sessionFull}|${row.authLoading}|${row.lessonLoading}|${row.pill}|${row.iframe}`;
    if (sig !== prev) { transitions.push(row); prev = sig; }
  }
  return {
    transitions,
    transitionCount: transitions.length,
    totalMut: f.length,
    diagTypes: [...new Set(diag.map(d=>d.type))],
    joined: diag.some(d=>d.type==='conference_joined'),
  };
});
fs.writeFileSync('/tmp/video-auth-flicker.json', JSON.stringify(data, null, 2));
console.log('transitions', data.transitionCount, 'mut', data.totalMut, 'joined', data.joined);
console.log(JSON.stringify(data.transitions.slice(0,40), null, 2));
console.log('--- mid ---');
console.log(JSON.stringify(data.transitions.slice(40,80), null, 2));
await browser.close();
