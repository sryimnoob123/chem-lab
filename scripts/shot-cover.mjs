import { chromium } from "@playwright/test";
import path from "node:path";
import os from "node:os";

const url = process.argv[2] ?? "http://localhost:3001/preview.html";
const out = path.join(os.tmpdir(), "chemlab-shots", "preview-cover.png");
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e.message)));
page.on("requestfailed", (r) => errs.push("fail:" + r.url().slice(-40)));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1440, height: 1100 } });
const svgCount = await page.locator("svg.cover__scene").count();
const broken = await page.evaluate(() =>
  [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src.split("/").slice(-2).join("/")),
);
console.log(`封面截图: ${out}`);
console.log(`封面 SVG: ${svgCount} · 坏图 ${broken.length} · 报错 ${errs.length}`);
if (broken.length) console.log(broken.slice(0, 3).join(", "));
await b.close();
