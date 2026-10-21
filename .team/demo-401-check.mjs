import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const bad = [];
page.on("response", (r) => {
  if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
});

await page.goto(`${base}/exp/exp09?force=1&play=demo`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const state = await page.evaluate(() => {
  const badge = document.querySelector('[data-demo-id="demo-readonly-badge"]');
  const bulb = document.querySelector('[data-demo-id="demo-hint-button"]');
  return {
    readonly: Boolean(badge),
    badgeText: badge?.textContent?.trim(),
    bulb: bulb?.textContent?.trim(),
  };
});
console.log("demo state:", JSON.stringify(state));
console.log("4xx:", bad.length ? bad.join(" | ") : "none");
await browser.close();
