import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'https://lk.longhuachinese.online';
const LESSON_ID = fs.readFileSync('/tmp/video-verify-lesson.id','utf8').trim();
const TEACHER_JWT = fs.readFileSync('/tmp/teacher.jwt.live','utf8').trim();
const STUDENT_JWT = fs.readFileSync('/tmp/student.jwt.live','utf8').trim();

async function setup(token, name) {
  const ctx = await browser.newContext({ permissions:['camera','microphone'], viewport:{width:1280,height:800} });
  await ctx.grantPermissions(['camera','microphone'], { origin: BASE });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => logs.push({t:new Date().toISOString(), type:m.type(), text:m.text().slice(0,400)}));
  page.on('pageerror', e => logs.push({t:new Date().toISOString(), type:'pageerror', text:String(e).slice(0,400)}));
  page.on('response', r => {
    if (r.status() >= 400 && (r.url().includes('/api/') || r.url().includes('meet.'))) {
      logs.push({t:new Date().toISOString(), type:'http', text:`${r.status()} ${r.url().slice(0,180)}`});
    }
  });
  await page.addInitScript(t => localStorage.setItem('longhua_access_token', t), token);
  return {ctx, page, logs, name};
}

async function dump(page, label) {
  const st = await page.evaluate(() => {
    let diag=[]; try { diag=JSON.parse(sessionStorage.getItem('longhua_video_diag')||'[]'); } catch {}
    return {
      path: location.pathname,
      title: document.title,
      body: (document.body?.innerText||'').slice(0,2500),
      iframeCount: document.querySelectorAll('iframe').length,
      iframeSrc: [...document.querySelectorAll('iframe')].map(i=>i.src).slice(0,3),
      connection: document.querySelector('[data-testid="lesson-video-connection"]')?.textContent || null,
      buttons: [...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean).slice(0,30),
      diag: diag.slice(-30),
      diagTypes: [...new Set(diag.map(d=>d.type))],
    };
  });
  await page.screenshot({ path: `/tmp/probe-${label}.png`, fullPage: true });
  return st;
}

const browser = await chromium.launch({
  headless: true,
  args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']
});
const teacher = await setup(TEACHER_JWT, 'teacher');
const student = await setup(STUDENT_JWT, 'student');

async function join(role) {
  const {page, logs} = role;
  await page.goto(`${BASE}/lesson/${LESSON_ID}/video`, { waitUntil:'domcontentloaded', timeout:90000 });
  await page.waitForTimeout(2500);
  const before = await dump(page, `${role.name}-before`);
  const joinBtn = page.getByRole('button', { name: /Начать урок|Войти в урок|Повторить|Join|Start/i }).first();
  const visible = await joinBtn.isVisible().catch(()=>false);
  if (visible) {
    await joinBtn.click();
    await page.waitForTimeout(12000);
  } else {
    await page.waitForTimeout(8000);
  }
  const after = await dump(page, `${role.name}-after`);
  return { before, after, logs: logs.slice(-40), joinClicked: visible };
}

const t = await join(teacher);
const s = await join(student);
await teacher.page.waitForTimeout(15000);
const tFinal = await dump(teacher.page, 'teacher-final');
const sFinal = await dump(student.page, 'student-final');

const out = { t, s, tFinal, sFinal, teacherLogs: teacher.logs.slice(-50), studentLogs: student.logs.slice(-50) };
fs.writeFileSync('/tmp/video-join-probe.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  teacher: { joinClicked:t.joinClicked, path:tFinal.path, connection:tFinal.connection, iframe:tFinal.iframeCount, diagTypes:tFinal.diagTypes, buttons:tFinal.buttons.slice(0,10), bodyHead:tFinal.body.slice(0,400) },
  student: { joinClicked:s.joinClicked, path:sFinal.path, connection:sFinal.connection, iframe:sFinal.iframeCount, diagTypes:sFinal.diagTypes, buttons:sFinal.buttons.slice(0,10), bodyHead:sFinal.body.slice(0,400) },
  teacherHttp: teacher.logs.filter(l=>l.type==='http'||l.type==='error'||l.type==='pageerror').slice(0,20),
  studentHttp: student.logs.filter(l=>l.type==='http'||l.type==='error'||l.type==='pageerror').slice(0,20),
}, null, 2));
await browser.close();
