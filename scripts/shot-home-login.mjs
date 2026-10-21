import { chromium } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const outDir = path.join(os.tmpdir(), "chemlab-shots", "home-login");
fs.mkdirSync(outDir, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/favicon|Failed to load resource/.test(t)) return;
  errors.push("console:" + t.slice(0, 100));
});
page.on("requestfailed", (r) => {
  const u = r.url();
  if (/_next\/static/.test(u)) errors.push("chunk404:" + u.slice(-50));
});

async function shot(url, name, wait = 1500) {
  await page.goto(base + url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(wait);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const imgs = await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length);
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
  console.log(`${name}: overflow=${overflow} 坏图=${imgs}`);
}

await shot("/", "01-home.png", 2000);
await shot("/login", "02-login.png", 2000);

// 移动端
await ctx.close();
const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce", isMobile: true });
const mp = await m.newPage();
await mp.goto(base + "/login", { waitUntil: "domcontentloaded" });
await mp.waitForTimeout(1500);
const overflowM = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
await mp.screenshot({ path: path.join(outDir, "03-login-390.png") });
console.log(`03-login-390: overflow=${overflowM}`);

await b.close();
console.log(`\npageerror ${errors.length}${errors.length ? " · " + errors.slice(0, 3).join(" | ") : ""}`);
console.log("目录:", outDir);
process.exitCode = errors.length ? 1 : 0;
