/**
 * exp03 整链验收（生产口）。自动寻找"可恢复 trap"：从倒数第二个缩到第一个试，
 * 点到实验终止就重新进页再试，避免误点 L4 终止项。
 * 截图落 public/shots-prod/exp03/
 * 用法：BASE_URL=http://localhost:3001 node scripts/exp03-chain.mjs [TRAP_ID]
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { clickOp, clickRetry, loginStudent, passPreTest, waitForFeedback } from "./lib/click-op.mjs";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const expId = "exp03";
const trapId = process.argv[2] ?? process.env.TRAP_ID ?? "";
const dir = path.join("public", "shots-prod", expId);
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
  steps.push({ k, ok: true });
  console.log(`[OK] ${k} · ${d}`);
};
const bad = (k, d) => {
  steps.push({ k, ok: false });
  console.log(`[X ] ${k} · ${d}`);
};

const openExp = async () => {
  await page.goto(`${base}/exp/${expId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
};
const optsSel = "[data-demo-id^='demo-op-']";

try {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await shot("门户", "portal");

  await loginStudent(page, { base });
  await shot("实验选择", "catalog");

  const resp = await openExp();
  await shot("实验页初始", `${expId}-initial`);
  ok(`进入 ${expId}`, `HTTP ${resp?.status() ?? 200}`);

  // 前测门禁：首次进入要全对才解锁操作台
  const curriculum = (await import(`../lib/pedagogy/curriculum/${expId}.ts`))[`${expId}Curriculum`];
  const pre = await passPreTest(page, curriculum);
  if (pre.appeared && !pre.passed) bad("前测门禁", "提交后操作台未解锁");

  const cnt = await page.locator(optsSel).count();
  ok("动作选项可见", `${cnt} 个`);
  if (cnt < 2) throw new Error(`选项不足：${cnt}`);

  // ---- 找可恢复 trap ----
  let recoveryId = "";
  const candidates = trapId ? [trapId] : [];
  // 引导式：nth(0) 是「建议动作」（正确动作），陷阱都在「其他做法」里；
  // 定义文件通常把「可恢复 trap」放在最后一项，所以从 cnt-1 往回试（0 跳过，点了只会推进步骤）
  for (let i = cnt - 1; i >= 1; i--) candidates.push(`__index__${i}`);

  for (const cand of candidates) {
    if (!recoveryId) {
      await openExp();
      const loc = cand.startsWith("__index__")
        ? page.locator(optsSel).nth(Number(cand.replace("__index__", "")))
        : page.locator(`[data-demo-id='${cand}']`).first();
      if (!(await loc.count())) continue;
      // 引导式操作台：非建议动作收在「其他做法」折叠区，clickOp 会先展开再点
      const clicked = await clickOp(page, loc);
      if (!clicked) continue;
      await waitForFeedback(page, undefined, { timeout: 2500 });
      const hasRetry = await page.locator("[data-demo-id^='demo-retry-']").count();
      if (hasRetry) recoveryId = cand;
    }
  }

  if (!recoveryId) throw new Error("没找到可恢复 trap（所有候选都进了终止态）");
  await shot("失败分支", "failure");
  const failText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const hasExplain = /错在哪|为什么|正确做法|L\d/.test(failText);
  if (hasExplain) ok("失败分支有两行教学解释", recoveryId.startsWith("__") ? `索引 ${recoveryId}` : recoveryId);
  else bad("失败教学解释", "未找到「为什么/正确做法」");

  await clickRetry(page);
  await page.waitForTimeout(700);
  await shot("重试", "retry");
  ok("重试", "回到本步");

  await clickOp(page, page.locator(optsSel).first());
  await waitForFeedback(page, "ok", { timeout: 3000 });
  await shot("成功", "success");
  ok("成功分支", "已出反馈");

  const fin = page.locator("[data-demo-id='demo-finish']").first();
  if (await fin.count()) {
    await fin.click();
    await page.waitForTimeout(2500);
    await shot("报告", "report");
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const scored = /总分/.test(text) && /[1-9]\d?\s*\/\s*100/.test(text);
    const hasNo = /20250101/.test(text);
    if (scored && hasNo) ok("报告出分", new URL(page.url()).pathname);
    else bad("报告出分", text.slice(0, 90));
  } else bad("交卷", "没有交卷按钮");
} catch (e) {
  bad("链路", String(e).slice(0, 130));
}

await b.close();
const failed = steps.filter((s) => !s.ok).length;
console.log(`\n截图 ${n} 张 · pageerror/console ${errors.length} · 失败 ${failed}`);
if (errors.length) console.log("错误:", errors.slice(0, 4).join(" | "));
console.log("目录:", dir);
process.exitCode = failed || errors.length ? 1 : 0;
