import { chromium } from "playwright";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3002";
const outDir = path.join(os.tmpdir(), "chemlab-shots", "20261022-hint");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto(`${base}/exp/exp09?force=1`, { waitUntil: "domcontentloaded" });
const close = page.locator('button[aria-label="关闭新手教学"]');
await close.click({ timeout: 4000 }).catch(() => {});
const bulb = page.locator('[data-demo-id="demo-hint-button"]');
await bulb.waitFor({ timeout: 20000 });

const shots = [];
async function shot(name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  shots.push(file);
}

async function readGuide() {
  return page.locator('[data-demo-id="demo-mission-board"]').innerText().catch(() => "");
}

await shot("00-before-hint");
for (const [index, name] of ["hint-l1", "hint-l2", "hint-l3"].entries()) {
  await bulb.click();
  await page.waitForTimeout(450);
  await shot(name);
  const data = await bulb.evaluate((el) => ({
    level: el.getAttribute("data-level"),
    exhausted: el.getAttribute("data-exhausted"),
    disabled: el.disabled,
    text: el.textContent,
  }));
  console.log(name, JSON.stringify(data), "guide=", (await readGuide()).replace(/\n/g, " | ").slice(0, 220));
}

// 第 4 次：按钮应该置灰、文案“本步提示已用完”
const state4 = await bulb.evaluate((el) => ({
  disabled: el.disabled,
  exhausted: el.getAttribute("data-exhausted"),
  text: el.textContent,
}));
await shot("hint-exhausted");
console.log("hint-exhausted", JSON.stringify(state4));

// 展开看板，确认折叠区也显示已用次数
await page.locator('[data-demo-id="demo-mission-board"] button[data-board-toggle="true"]').click();
await page.waitForTimeout(300);
await shot("hint-board-open");

console.log("shots:", shots.join("\n"));
console.log("pageerrors:", errors.length, errors.slice(0, 5));
await browser.close();
