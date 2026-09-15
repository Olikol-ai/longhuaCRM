import { chromium } from 'playwright';
import fs from 'fs';
const BASE='https://lk.longhuachinese.online';
const LESSON_ID=fs.readFileSync('/tmp/video-verify-lesson.id','utf8').trim();
const TEACHER_JWT=fs.readFileSync('/tmp/teacher.jwt.live','utf8').trim();
const STUDENT_JWT=fs.readFileSync('/tmp/student.jwt.live','utf8').trim();

async function open(token) {
  const ctx = await browser.newContext({ permissions:['camera','microphone'], viewport:{width:1280,height:800}});
  await ctx.grantPermissions(['camera','microphone'], { origin: BASE });
  const page = await ctx.newPage();
  const http = [];
  page.on('response', r => { if (r.status()>=400) http.push({t:Date.now(), status:r.status(), url:r.url().slice(0,120)}); });
  await page.addInitScript(t => localStorage.setItem('longhua_access_token', t), token);
  return {ctx, page, http};
}

const browser = await chromium.launch({ headless:true, args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const teacher = await open(TEACHER_JWT);
const student = await open(STUDENT_JWT);

async function join(role, label) {
  await role.page.goto(`${BASE}/lesson/${LESSON_ID}/video`, {waitUntil:'domcontentloaded', timeout:90000});
  await role.page.waitForTimeout(2000);
  const btn = role.page.getByRole('button', { name: /Начать урок|Войти в урок/i }).first();
  await btn.waitFor({timeout:60000});
  await btn.click();
  console.log(label, 'clicked join');
}

await join(teacher, 'teacher');
await teacher.page.waitForTimeout(3000);
await join(student, 'student');

const rows=[];
for (let i=0;i<60;i++) {
  await teacher.page.waitForTimeout(2000);
  const t = await teacher.page.evaluate(() => {
    let diag=[]; try{diag=JSON.parse(sessionStorage.getItem('longhua_video_diag')||'[]');}catch{}
    return {
      pill: document.querySelector('[data-testid="lesson-video-connection"]')?.textContent||null,
      full: !!document.querySelector('[data-testid="lesson-video-session-full"]'),
      iframe: document.querySelectorAll('iframe').length,
      joined: diag.some(d=>d.type==='conference_joined'),
      types: [...new Set(diag.map(d=>d.type))],
      n: diag.length,
      last: diag[diag.length-1]?.type||null,
    };
  });
  const s = await student.page.evaluate(() => {
    let diag=[]; try{diag=JSON.parse(sessionStorage.getItem('longhua_video_diag')||'[]');}catch{}
    return {
      pill: document.querySelector('[data-testid="lesson-video-connection"]')?.textContent||null,
      iframe: document.querySelectorAll('iframe').length,
      joined: diag.some(d=>d.type==='conference_joined'),
      n: diag.length,
    };
  });
  rows.push({i, t, s, t429: teacher.http.filter(x=>x.status===429).length, s429: student.http.filter(x=>x.status===429).length});
  console.log(`i=${i} T pill=${t.pill} iframe=${t.iframe} joined=${t.joined} n=${t.n} last=${t.last} | S pill=${s.pill} iframe=${s.iframe} joined=${s.joined}`);
  if (t.joined && s.joined) break;
}
fs.writeFileSync('/tmp/video-wait-join.json', JSON.stringify({rows, teacherHttp:teacher.http.slice(-30), studentHttp:student.http.slice(-30)}, null, 2));
await browser.close();
