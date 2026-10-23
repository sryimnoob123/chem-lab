/**
 * 单帧取证：把某台器皿（含液体）按元素裁一张高倍图，给 vision 看细节。
 * 用法：BASE_URL=http://localhost:3000 OUT=.../x.png node scripts/scene-snap.mjs <path> <selector>
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT ?? path.join(process.env.TEMP ?? ".", "chemlab-shots", "scene-snap.png");
const PAGE = process.argv[2] ?? "/exp/exp03?force=1";
const SEL = process.argv[3] ?? "[data-vessel-art='beaker']";
const PAD = Number(process.env.PAD ?? 10);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 4 });
const page = await ctx.newPage();
await page.goto(BASE + PAGE, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const el = page.locator(SEL).first();
const box = await el.boundingBox();
if (!box) throw new Error("找不到元素 " + SEL);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await page.screenshot({
  path: OUT,
  clip: {
    x: Math.max(0, box.x - PAD),
    y: Math.max(0, box.y - PAD),
    width: Math.min(1440, box.width + PAD * 2),
    height: Math.min(900, box.height + PAD * 2),
  },
});
console.log("saved", OUT, box);
await browser.close();
