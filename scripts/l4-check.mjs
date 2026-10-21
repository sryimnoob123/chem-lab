/**
 * 四级事故系统：L4 终止路径端到端（exp10 的活塞硬拧）
 * 用法：BASE_URL=http://localhost:3001 node scripts/l4-check.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { clickOp, clickRetry, loginStudent, passPreTest } from "./lib/click-op.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const outDir = path.join(os.tmpdir(), "chemlab-shots", "l4");
fs.mkdirSync(outDir, { recursive: true });

const expId = "exp10";
const l4Id = "demo-op-step2-piston-force";
const mod = await import(`../lib/pedagogy/curriculum/${expId}.ts`);
const c = mod[`${expId}Curriculum`];

const steps = [];
const errors = [];
let n = 0;
const ok = (k, d) => {
  steps.push({ k, ok: true });
  console.log(`[OK] ${k} · ${d}`);
};
const bad = (k, d) => {
  steps.push({ k, ok: false });
  console.log(`[X ] ${k} · ${d}`);
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
const shot = async (slug) => {
  await page.waitForTimeout(400);
  const name = `${String(++n).padStart(2, "0")}-${slug}.png`;
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
};

await loginStudent(page, { base });
await page.evaluate(() => window.localStorage.clear());
await page.goto(`${base}/exp/${expId}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

// 过前测（门禁）：全对后操作台在同页解锁
const pre = await passPreTest(page, c);
if (pre.appeared && !pre.passed) bad("前测门禁", "提交后操作台未解锁");
await page.waitForSelector("[data-demo-id^='demo-op-step1-']", { state: "visible", timeout: 15000 }).catch(() => {});

// 走到第 2 步：点「建议动作」把第 1 步的前置动作依次做完（引导式下正确动作不是 demo-op-*，
// 只有陷阱才是 demo-op-*，所以不能再按 demo-op 遍历；建议动作按钮带 data-guide="next"）
for (let attempt = 0; attempt < 10; attempt++) {
  if (await page.locator("[data-demo-id^='demo-op-step2-']").count()) break;
  const next = page.locator("button[data-guide='next']").first();
  if ((await next.count()) === 0) {
    await page.waitForTimeout(800); // dev 首帧还在编译/挂载
    continue;
  }
  await next.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(900);
  const retry = page.locator("[data-demo-id^='demo-retry-']").first();
  if (await retry.count()) {
    await clickRetry(page);
    await page.waitForTimeout(700);
  }
}
const l4 = page.locator(`[data-demo-id='${l4Id}']`);
if (!(await l4.count())) {
  bad("L4 选项可见", "第 2 步没找到 " + l4Id);
} else {
  const l4Clicked = await clickOp(page, l4);
  if (!l4Clicked) bad("L4 选项可点", "第 2 步的 L4 动作点不下去（折叠区未展开或前置未满足）");
  await page.waitForTimeout(1600);
  const txt = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const terminated = /终止|事故|无法继续|实验结束/.test(txt);
  if (terminated) ok("L4 终止提示", txt.match(/[^ ]{0,24}(终止|事故)[^ ]{0,24}/)?.[0] ?? "已出现");
  else bad("L4 终止", txt.slice(0, 80));
  await shot("l4-terminated");

  // 交卷看报告
  const fin = page.locator("[data-demo-id='demo-finish']").first();
  if (await fin.count()) {
    await fin.click();
    await page.waitForTimeout(2500);
    await shot("l4-report");
    const rt = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const hasIncident = /事故\s*\d|事故清单|事故数/.test(rt);
    if (hasIncident) ok("报告含事故记录", rt.match(/事故[^ ]{0,16}/)?.[0] ?? "有");
    else bad("报告事故记录", rt.slice(0, 80));
  } else bad("交卷", "没找到交卷按钮");
}

await b.close();
const failed = steps.filter((s) => !s.ok).length;
console.log(`\n截图 ${n} 张 · pageerror ${errors.length} · 失败 ${failed}`);
console.log("目录:", outDir);
process.exitCode = failed || errors.length ? 1 : 0;
