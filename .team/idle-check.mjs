import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/exp/exp09?force=1`, { waitUntil: "domcontentloaded" });
await page.locator('button[aria-label="关闭新手教学"]').click({ timeout: 6000 }).catch(() => {});
await page.locator('[data-demo-id="demo-hint-button"]').waitFor({ timeout: 25000 });

async function read(tag) {
  const state = await page.evaluate(() => {
    const board = document.querySelector('[data-demo-id="demo-mission-board"]')?.textContent?.replace(/\s+/g, " ") ?? "";
    const bulb = document.querySelector('[data-demo-id="demo-hint-button"]');
    return { board: board.slice(0, 150), level: bulb?.getAttribute("data-level"), text: bulb?.textContent };
  });
  console.log(tag, JSON.stringify(state));
}

await read("t=0   ");
await page.waitForTimeout(15000);
await read("t=15s ");
await page.waitForTimeout(12000);
await read("t=27s ");
await browser.close();
