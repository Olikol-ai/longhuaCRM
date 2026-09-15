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
  window.__wipes = [];
  const push = (row) => {
    window.__wipes.push({ ...row, t: new Date().toISOString(), stack: (new Error()).stack.split('\n').slice(1,10).join(' || ') });
    if (window.__wipes.length > 40) window.__wipes.shift();
  };
  const origRemove = Node.prototype.removeChild;
  Node.prototype.removeChild = function(child) {
    if (this === document.body || this === document.documentElement || (this.id === 'root')) {
      push({ kind: 'removeChild', parent: this.id || this.nodeName, child: child?.nodeName });
    }
    // also if removing session-full
    try {
      if (child?.getAttribute?.('data-testid') === 'lesson-video-session-full' ||
          child?.querySelector?.('[data-testid="lesson-video-session-full"]')) {
        push({ kind: 'removeSession', parent: this.id || this.nodeName });
      }
    } catch {}
    return origRemove.call(this, child);
  };
  const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) {
      if (this === document.body || this.id === 'root' || this.getAttribute?.('data-testid') === 'lesson-video-jitsi') {
        push({ kind: 'innerHTML', target: this.id || this.getAttribute?.('data-testid') || this.nodeName, len: String(v).length });
      }
      return desc.set.call(this, v);
    }
  });
}, TEACHER_JWT);

await page.goto(`${BASE}/lesson/${LESSON_ID}/video`, {waitUntil:'domcontentloaded', timeout:90000});
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /Начать урок/i }).first().click();
await page.waitForTimeout(5000);
const wipes = await page.evaluate(() => window.__wipes || []);
fs.writeFileSync('/tmp/video-dom-wipe.json', JSON.stringify(wipes, null, 2));
console.log('wipe count', wipes.length);
for (const w of wipes.slice(0, 15)) {
  console.log('\n', w.kind, w.target || w.parent, w.child || '', '\n ', w.stack.slice(0,400));
}
await browser.close();
