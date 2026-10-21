/**
 * 拼接式方案设计 + 教师端学情导出 验收
 * 用法：BASE_URL=http://localhost:3001 node scripts/plan-teacher-check.mjs
 * 截图落 %TEMP%\chemlab-shots\plan-teacher\
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const outDir = path.join(os.tmpdir(), "chemlab-shots", "plan-teacher");
fs.mkdirSync(outDir, { recursive: true });

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
const ctx = await b.newContext({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/favicon|Failed to load resource/.test(t)) return;
  errors.push("console:" + t.slice(0, 100));
});
const shot = async (slug) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(350);
  const name = `${String(++n).padStart(2, "0")}-${slug}.png`;
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
};

// 登录
await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
await page.locator("[data-demo-id='demo-login-submit']").click();
await page.waitForURL(/\/experiments/, { timeout: 15000 });

// ---- 方案设计 ----
await page.goto(base + "/plan", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
const hasDesigner = await page.locator("[data-demo-id='demo-design-score']").count();
if (hasDesigner) ok("方案设计页打开", "/plan");
else bad("方案设计页", "没找到评分元素");
await shot("plan-empty");

// 空方案应有违规
const emptyIssues = await page.locator("[data-demo-id='demo-design-issues'] li").count();
ok("空方案给出违规提示", `${emptyIssues} 条`);

// 载入参考方案
await page.locator("[data-demo-id='demo-design-reference']").click();
await page.waitForTimeout(900);
const scoreText = (await page.locator("[data-demo-id='demo-design-score']").innerText()).trim();
ok("参考方案评分", scoreText);
await shot("plan-reference");

const issueCount = await page.locator("[data-demo-id='demo-design-issues'] li").count();
if (/100/.test(scoreText) && issueCount === 0) ok("参考方案满 100 且无违规", "0 条");
else bad("参考方案校验", `score=${scoreText} issues=${issueCount}`);

// 故意去掉一个关键块（基准物），应掉分
await page.locator("[data-demo-id='demo-design-tab-reagent']").click();
await page.waitForTimeout(300);
await page.locator("[data-demo-id='demo-design-piece-sodium-carbonate']").click();
await page.waitForTimeout(800);
const scoreAfter = (await page.locator("[data-demo-id='demo-design-score']").innerText()).trim();
const issuesAfter = await page.locator("[data-demo-id='demo-design-issues'] li").count();
if (scoreAfter !== scoreText && issuesAfter > 0) ok("拿掉基准物后掉分并报错", `score=${scoreAfter} issues=${issuesAfter}`);
else bad("反例校验", `score=${scoreAfter} issues=${issuesAfter}`);
await shot("plan-broken");

// 存回来 + 保存
await page.locator("[data-demo-id='demo-design-reference']").click();
await page.waitForTimeout(600);
await page.locator("[data-demo-id='demo-design-save']").click();
await page.waitForTimeout(1500);
const msg = (await page.locator("[data-demo-id='demo-design-save-msg']").innerText().catch(() => "")).trim();
if (/已保存/.test(msg)) ok("保存方案落库", msg);
else bad("保存方案", msg || "没有提示");
await shot("plan-saved");

// ---- 教师端 ----
await page.goto(base + "/teacher", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
// 先教师解锁（顶栏「教师解锁」→ 口令 2026）
const unlockBtn = page.locator("button").filter({ hasText: "教师解锁" }).first();
if (await unlockBtn.count()) {
  await unlockBtn.click();
  await page.waitForTimeout(400);
  await page.locator("#tch-passcode").fill("2026");
  await page.locator(".tch-unlock__submit, button[type='submit']").first().click();
  await page.waitForTimeout(1600);
  ok("教师解锁", "口令 2026");
}
const t2 = (await page.locator("body").innerText()).replace(/\s+/g, " ");
if (/学情总览|学生台账|完成/.test(t2)) ok("教师端可进入", t2.slice(0, 40));
else bad("教师端", t2.slice(0, 80));
await shot("teacher");

// 导出 CSV
const exportBtn = page.locator("[data-demo-id='demo-teacher-export']").first();
if (await exportBtn.count()) {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }).catch(() => null),
    exportBtn.click().catch(() => {}),
  ]);
  if (dl) {
    const p = await dl.path();
    const buf = fs.readFileSync(p);
    const bom = buf.subarray(0, 3).toString("hex") === "efbbbf";
    ok("导出 CSV（页面按钮）", `${dl.suggestedFilename()} · ${buf.length} 字节 · BOM=${bom ? "有" : "无"}`);
    if (!bom) bad("CSV 缺 BOM", "Excel 中文会乱码");
    const text = buf.toString("utf8");
    const head = text.split(/\r?\n/)[0] ?? "";
    ok("CSV 表头", head.slice(0, 60));
  } else {
    const msg = (await page.locator("[data-demo-id='demo-teacher-export-msg']").innerText().catch(() => "")).trim();
    bad("导出 CSV（页面按钮）", msg || "没有触发下载");
  }
} else {
  bad("导出按钮", "页面没有 data-demo-id=demo-teacher-export");
}
await shot("teacher-export");

await b.close();
const failed = steps.filter((s) => !s.ok).length;
console.log(`\n截图 ${n} 张 · pageerror ${errors.length} · 失败 ${failed}`);
if (errors.length) console.log(errors.slice(0, 3).join(" | "));
console.log("目录:", outDir);
process.exitCode = failed || errors.length ? 1 : 0;
