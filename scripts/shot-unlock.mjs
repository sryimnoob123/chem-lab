/**
 * 截图：/experiments 分层解锁态（g1 解锁、g2/g3 锁定）
 * 用法：node scripts/shot-unlock.mjs [base]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3001";
const outDir = path.join(process.env.TEMP ?? "/tmp", "chemlab-shots", "unlock");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const errors = [];

async function shot(width, height, name) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));

  // 登录（拿到 chem_sid cookie）
  const res = await page.request.post(`${base}/api/session`, {
    data: { studentNo: "20250101", name: "周若曦" },
  });
  if (!res.ok()) console.log(`登录失败 ${res.status()}`);

  await page.goto(`${base}/experiments`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(800);
  // Reveal 入场动画靠 IntersectionObserver 触发：先滚到底再滚回顶部，确保所有行进入过视口
  for (let y = 0; y < 6; y++) {
    await page.evaluate((n) => window.scrollBy(0, window.innerHeight * 0.8 * n), 1);
    await page.waitForTimeout(160);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const info = await page.evaluate(() => {
    const groups = [...document.querySelectorAll(".cat-group")].map((s) => ({
      title: s.querySelector("h2")?.textContent?.trim(),
      locked: s.querySelector('[data-demo-id^="demo-group-locked"]') !== null,
      hint: s.querySelector(".cat-group__lock")?.textContent?.trim() ?? "",
      progress: s.querySelector(".cat-group__progress")?.textContent?.trim() ?? "",
      lockedList: s.querySelector('.cat-list[data-locked="true"]') !== null,
    }));
    return {
      groups,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  console.log(name, JSON.stringify(info, null, 0));
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  await ctx.close();
}

await shot(1440, 900, "experiments-1440");
await shot(390, 844, "experiments-390");
await browser.close();
console.log("pageerror:", errors.length, errors.slice(0, 3).join(" | "));
console.log("目录:", outDir);
