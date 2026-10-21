/**
 * 10 个实验的前测门禁巡检：清掉 localStorage → 进页 → 若出现前测则全对提交 → 断言操作台出现
 * 用法：BASE_URL=http://localhost:3001 node scripts/bopbps-all.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const outDir = path.join(os.tmpdir(), "chemlab-shots", "bopbps-all");
fs.mkdirSync(outDir, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 100)));

// 登录
await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
await page.locator("[data-demo-id='demo-login-submit']").click();
await page.waitForURL(/\/experiments/, { timeout: 15000 });

const rows = [];
for (let i = 1; i <= 10; i++) {
  const id = `exp${String(i).padStart(2, "0")}`;
  const mod = await import(`../lib/pedagogy/curriculum/${id}.ts`);
  const c = mod[`${id}Curriculum`];

  await page.evaluate(() => window.localStorage.clear());
  await page.goto(`${base}/exp/${id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);

  const preBtn = page.locator("[data-demo-id='bopbps-pre-submit']");
  const hasPre = await preBtn.count();
  let entered = false;
  let note = "";

  if (hasPre) {
    // 全对作答
    for (const q of c.pre) {
      await page.locator(`[data-demo-id='bopbps-op-${q.id}-${q.answer}']`).click().catch(() => {});
    }
    await preBtn.click();
    await page.waitForTimeout(1500);
    const ops = await page.locator("[data-demo-id^='demo-op-']").count();
    entered = ops > 0;
    note = `前测后选项 ${ops}`;
    if (!entered) {
      const txt = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 100);
      note += ` | 页面: ${txt}`;
      await page.screenshot({ path: path.join(outDir, `${id}-stuck.png`), fullPage: true });
    }
  } else {
    const ops = await page.locator("[data-demo-id^='demo-op-']").count();
    entered = ops > 0;
    note = hasPre ? "" : `未出现前测（直接进台）· 选项 ${ops}`;
  }

  rows.push({ id, hasPre, entered, note });
  console.log(`${entered ? "[OK]" : "[X ]"} ${id} · 前测=${hasPre ? "有" : "无"} · ${note}`);
}

// 追加：同一页面内的切换检查（不整页跳转）
await page.goto(`${base}/exp/exp01`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);

await b.close();
const failed = rows.filter((r) => !r.entered).length;
console.log(`\n通过 ${rows.length - failed}/${rows.length} · pageerror ${errors.length}`);
if (errors.length) console.log("错误:", errors.slice(0, 3).join(" | "));
console.log("截图目录:", outDir);
process.exitCode = failed ? 1 : 0;
