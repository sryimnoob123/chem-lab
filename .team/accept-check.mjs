import { chromium } from "playwright";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const outDir = path.join(os.tmpdir(), "chemlab-shots", "20261022-drop");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/exp/exp01?force=1`, { waitUntil: "domcontentloaded" });
await page.locator('button[aria-label="关闭新手教学"]').click({ timeout: 5000 }).catch(() => {});
const flask = page.locator('[data-demo-id="demo-scene-drop-flask"]');
await flask.waitFor({ timeout: 25000 });

async function state() {
  return page.evaluate(() => {
    const progress = document.querySelector('[data-demo-id="demo-guide-progress"]')?.textContent ?? "";
    const pour = document.querySelector("[data-pour-key]") ? "pouring" : "-";
    const reject = Boolean(document.querySelector('[data-demo-id="demo-reject-hint"]'));
    const caption = [...document.querySelectorAll('[role="status"]')].map((el) => el.textContent?.trim()).filter(Boolean).join(" | ");
    return { progress: progress.replace(/\s+/g, " ").trim(), pour, reject, caption: caption.slice(0, 60) };
  });
}

for (let i = 0; i < 16; i += 1) {
  const s = await state();
  console.log(`round ${i + 1}:`, JSON.stringify(s.progress));
  if (/第 4\/7/.test(s.progress)) break;
  await page.locator('[data-demo-id="demo-guide-card"] > button').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1300);
}

const water = page.locator('[data-demo-id="demo-scene-reagent-water"]').first();
const solid = page.locator('[data-demo-id="demo-scene-reagent-na2co3-solid"]').first();
const drag = (await water.count()) ? water : solid;
const box = await drag.boundingBox();
const fbox = await flask.boundingBox();
if (!box || !fbox) throw new Error("no boxes");
console.log("drag:", await drag.getAttribute("data-demo-id"), "step:", (await state()).progress);

await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(fbox.x + fbox.width / 2, fbox.y + fbox.height / 2, { steps: 10 });
await page.waitForTimeout(180);
await page.mouse.up();

const rows = [];
for (let t = 0; t <= 1600; t += 50) {
  if (t) await page.waitForTimeout(50);
  const s = await state();
  rows.push(`${String(t).padStart(4)}ms pour=${s.pour} reject=${s.reject} step=${s.progress} capt=${s.caption.slice(0, 24)}`);
}
console.log(rows.join("\n"));
await page.screenshot({ path: path.join(outDir, "accept-after.png") });
await browser.close();
