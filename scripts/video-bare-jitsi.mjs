import { chromium } from 'playwright';
import fs from 'fs';
const browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const logs=[];
page.on('console', m => logs.push(m.text()));
await page.goto('file:///tmp/jitsi-bare.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(25000);
const out = await page.evaluate(() => ({ log: window.__log || [], iframe: document.querySelectorAll('iframe').length }));
fs.writeFileSync('/tmp/video-bare-jitsi.json', JSON.stringify({ out, logs: logs.slice(-40) }, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('console', logs.filter(x=>/JOINED|FAIL|created|error|Error/i.test(x)).slice(0,20));
await browser.close();
