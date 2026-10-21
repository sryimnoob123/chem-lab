import { chromium } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const outDir = path.join(os.tmpdir(), "chemlab-shots", "prod-pages");
fs.mkdirSync(outDir, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 100)));
page.on("requestfailed", (r) => {
  const u = r.url();
  if (/_next\/static/.test(u)) errors.push("chunk404:" + u.slice(-40));
});

// 登录
await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
await page.fill('input[inputmode="numeric"]', "20250101");
await page.locator('input[autocomplete="name"]').fill("周若曦");
await page.locator("button[type=submit]").click();
await page.waitForURL(/\/experiments/, { timeout: 20000 });

async function shot(url, name, wait = 1200) {
  await page.goto(base + url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(wait);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const imgs = await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length);
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
  console.log(`${name}: overflow=${overflow} 坏图=${imgs}`);
}

await shot("/experiments", "01-experiments.png", 1500);
await shot("/exp/exp01?force=1", "02-exp01-workbench.png", 2500);
await shot("/exp/exp09?force=1&scene=3d", "03-exp09-3d.png", 3500);
await shot("/teacher", "04-teacher.png", 2000);
await shot("/dev", "05-dev.png", 1500);

await b.close();
console.log(`\npageerror ${errors.length}${errors.length ? " · " + errors.slice(0, 3).join(" | ") : ""}`);
console.log("目录:", outDir);
