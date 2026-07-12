import { chromium } from "playwright";
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
const title = await page.title();
console.log("Browser opened successfully. Page title:", title);
await page.waitForTimeout(2000);
await browser.close();
console.log("Browser closed.");
