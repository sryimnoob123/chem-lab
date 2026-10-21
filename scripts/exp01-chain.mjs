/**
 * exp01 整链验收（生产口用 BASE_URL）：门户→登录→选实验→点 exp01→操作→成功/失败→重做→交卷→报告
 * 截图落 public/shots-prod/exp01/
 * 用法：BASE_URL=http://localhost:3001 node scripts/exp01-chain.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { clickOp, clickRetry, loginStudent, passPreTest } from "./lib/click-op.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const dir = path.join("public", "shots-prod", "exp01");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const steps = [];
const errors = [];
let n = 0;

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 140)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/favicon|Failed to load resource/.test(t)) return;
  errors.push("console:" + t.slice(0, 120));
});

const shot = async (label, slug) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
  const name = `${String(++n).padStart(2, "0")}-${slug}.png`;
  await page.screenshot({ path: path.join(dir, name) });
  return name;
};
const ok = (k, d) => {
  steps.push({ k, ok: true, d });
  console.log(`[OK] ${k} · ${d}`);
};
const bad = (k, d) => {
  steps.push({ k, ok: false, d });
  console.log(`[X ] ${k} · ${d}`);
};

try {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await shot("门户", "portal");
  ok("门户", "已加载");

  await loginStudent(page, { base });
  await shot("实验选择", "catalog");

  const row = page.locator("[data-demo-id='demo-catalog-exp01']").first();
  const enterable = await row.getAttribute("aria-disabled");
  await row.click();
  await page.waitForURL(/\/exp\/exp01/, { timeout: 15000 });
  await page.waitForTimeout(900);
  await shot("实验页初始", "exp01-initial");
  ok("选择 exp01 → 进入操作台", `aria-disabled=${enterable}`);

  // 前测门禁：首次进入要全对才解锁操作台
  const curriculum = (await import("../lib/pedagogy/curriculum/exp01.ts")).exp01Curriculum;
  const pre = await passPreTest(page, curriculum);
  if (pre.appeared && !pre.passed) bad("前测门禁", "提交后操作台未解锁");

  // 底部动作按钮：取当前步第一个可点选项
  const opts = page.locator("[data-demo-id^='demo-op-']");
  const cnt = await opts.count();
  ok("动作选项可见", `${cnt} 个`);

  // 正确/失败分支：先点最后一个（通常是 trap），再点第一个（通常正确）
  if (cnt >= 2) {
    await clickOp(page, opts.nth(cnt - 1));
    await page.waitForTimeout(900);
    const failVisible = await page.locator("[data-demo-id$='-fail-1']").count();
    await shot("失败分支", "failure");
    const retry = page.locator("[data-demo-id^='demo-retry-']").first();
    if (await retry.count()) {
      await clickRetry(page);
      await page.waitForTimeout(700);
      await shot("重做本步", "retry");
      ok("失败分支 + 重做", `失败可见=${failVisible > 0}`);
    } else {
      bad("重做本步", "没有重做按钮");
    }
    await clickOp(page, opts.first());
    await page.waitForTimeout(900);
    await shot("成功分支", "success");
    ok("成功分支", "已出反馈");
  } else {
    bad("成功/失败分支", `选项不足（${cnt}）`);
  }

  // 交卷 → 报告
  const fin = page.locator("[data-demo-id='demo-finish']").first();
  if (await fin.count()) {
    await fin.click();
    await page.waitForTimeout(2500);
    await shot("报告", "report");
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const scored = /总分/.test(text) && /\d{2}\s*\/\s*100/.test(text);
    if (scored) ok("报告出分", new URL(page.url()).pathname);
    else bad("报告出分", text.slice(0, 80));
  } else {
    bad("交卷", "没有交卷按钮");
  }
} catch (e) {
  bad("链路", String(e).slice(0, 120));
}

await b.close();
const failed = steps.filter((s) => !s.ok).length;
console.log(`\n截图 ${n} 张 · pageerror/console ${errors.length} · 失败 ${failed}`);
if (errors.length) console.log("错误:", errors.slice(0, 4).join(" | "));
console.log("目录:", dir);
process.exitCode = failed || errors.length ? 1 : 0;
