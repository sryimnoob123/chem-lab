import { chromium } from "playwright";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const outDir = path.join(os.tmpdir(), "chemlab-shots", "20261022-drop");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(`${base}/exp/exp01?force=1`, { waitUntil: "domcontentloaded" });
await page.locator('button[aria-label="关闭新手教学"]').click({ timeout: 5000 }).catch(() => {});
const flask = page.locator('[data-demo-id="demo-scene-drop-flask"]');
await flask.waitFor({ timeout: 25000 });

const target = page.locator('button[data-demo-id^="demo-scene-reagent-"]').first();
const box = await target.boundingBox();
const fbox = await flask.boundingBox();
if (!box || !fbox) throw new Error("no drag boxes");
console.log("reagent:", await target.getAttribute("data-demo-id"));

const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
const fx = fbox.x + fbox.width / 2;
const fy = fbox.y + fbox.height / 2;

async function snapshot(tag) {
  const state = await page.evaluate(() => {
    const el = document.querySelector('button[data-demo-id^="demo-scene-reagent-"][data-dragging="true"]') ?? document.querySelector("button[data-demo-id^=\"demo-scene-reagent-\"]");
    const f = document.querySelector('[data-demo-id="demo-scene-drop-flask"]');
    const style = el ? getComputedStyle(el) : null;
    const reject = document.querySelector('[data-demo-id="demo-reject-hint"]');
    return {
      reagent: el ? { id: el.getAttribute("data-demo-id"), dragging: el.getAttribute("data-dragging"), opacity: style.opacity, transform: style.transform } : null,
      flask: f ? { over: f.getAttribute("data-over"), dragging: f.getAttribute("data-dragging") } : null,
      rejectVisible: Boolean(reject && reject.getClientRects().length),
      rejectText: reject?.textContent?.replace(/\s+/g, " ").slice(0, 120) ?? null,
    };
  });
  console.log(tag, JSON.stringify(state));
}

await page.mouse.move(cx, cy);
await page.mouse.down();
await page.waitForTimeout(200);
await snapshot("after-grab");
await page.mouse.move(cx + (fx - cx) * 0.5, cy + (fy - cy) * 0.5, { steps: 6 });
await page.waitForTimeout(140);
await snapshot("mid-drag");
await page.screenshot({ path: path.join(outDir, "drag-mid.png") });
await page.mouse.move(fx, fy, { steps: 8 });
await page.waitForTimeout(220);
await snapshot("over-flask");
await page.screenshot({ path: path.join(outDir, "drag-over.png") });

await page.mouse.up();
await page.waitForTimeout(90);
await snapshot("t+90-release");
await page.waitForTimeout(300);
await snapshot("t+390-bounce");
await page.screenshot({ path: path.join(outDir, "after-drop.png") });
await page.waitForTimeout(600);
await snapshot("t+990-after");

console.log("errors:", errors.length, errors.slice(0, 4));
console.log("shots:", outDir);
await browser.close();
