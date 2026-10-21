import { chromium } from "playwright";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const outDir = path.join(os.tmpdir(), "chemlab-shots", "20261022-mobile");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${base}/exp/exp09?force=1`, { waitUntil: "domcontentloaded" });
await page.locator('button[aria-label="关闭新手教学"]').click({ timeout: 6000 }).catch(() => {});
const bulb = page.locator('[data-demo-id="demo-hint-button"]');
await bulb.waitFor({ timeout: 25000 });

const metrics = await page.evaluate(() => {
  const doc = document.documentElement;
  const bulb = document.querySelector('[data-demo-id="demo-hint-button"]');
  const rect = bulb?.getBoundingClientRect();
  return {
    overflowX: doc.scrollWidth - doc.clientWidth,
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    bulb: rect ? { w: Math.round(rect.width), h: Math.round(rect.height) } : null,
  };
});
console.log("layout:", JSON.stringify(metrics));

await bulb.tap();
await page.waitForTimeout(400);
await bulb.tap();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, "hint-mobile-l2.png") });
const after = await bulb.evaluate((el) => ({ level: el.getAttribute("data-level"), text: el.textContent }));
console.log("after two taps:", JSON.stringify(after));
console.log("errors:", errors.length, errors.slice(0, 3));
console.log("shot:", outDir);
await browser.close();
