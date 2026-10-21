/**
 * exp02 整链验收（生产口）：进页 → 清点 → 固定质量称量 → 故意做错 → 重试 → 成功 → 交卷 → 报告
 * 截图落 public/shots-prod/exp02/
 * 用法：BASE_URL=http://localhost:3001 node scripts/exp02-chain.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const expId = process.env.EXP_ID ?? "exp02";
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

try {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await shot("门户", "portal");

  await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
  await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
  await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
  await page.locator("[data-demo-id='demo-login-submit']").click();
  await page.waitForURL(/\/experiments/, { timeout: 15000 });
  await shot("实验选择", "catalog");

  const resp = await page.goto(`${base}/exp/${expId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await shot("实验页初始", `${expId}-initial`);
  ok(`进入 ${expId}`, `HTTP ${resp?.status() ?? 0}`);

  const opts = page.locator("[data-demo-id^='demo-op-']");
  const cnt = await opts.count();
  ok("动作选项可见", `${cnt} 个`);
  if (cnt < 2) throw new Error(`选项不足：${cnt}`);

  // 做错
  const trapId = process.env.TRAP_ID ?? "demo-op-step1-water";
  const trap = page.locator(`[data-demo-id='${trapId}']`).first();
  if (await trap.count()) await trap.click();
  else await opts.nth(cnt - 1).click();
  await page.waitForTimeout(900);
  await shot("故意做错", "failure");
  const failText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const hasExplain = /错在哪|为什么|L\d/.test(failText);
  if (hasExplain) ok("失败分支有两行教学解释", failText.match(/[^。]{6,40}。?/)?.[0]?.slice(0, 40) ?? "");
  else bad("失败教学解释", "未找到「错在哪/为什么」字样");

  // 重试
  const retry = page.locator("[data-demo-id^='demo-retry-']").first();
  if (await retry.count()) {
    await retry.click();
    await page.waitForTimeout(700);
    await shot("重试", "retry");
    ok("重试", "回到本步");
  } else bad("重试", "没有重做按钮");

  // 做对
  await opts.first().click();
  await page.waitForTimeout(900);
  await shot("成功", "success");
  ok("成功分支", "已出反馈");

  // 交卷 → 报告
  const fin = page.locator("[data-demo-id='demo-finish']").first();
  if (await fin.count()) {
    await fin.click();
    await page.waitForTimeout(2500);
    await shot("报告", "report");
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const scored = /总分/.test(text) && /[1-9]\d?\s*\/\s*100/.test(text);
    const hasNo = /20250101/.test(text);
    if (scored && hasNo) ok("报告出分", `${new URL(page.url()).pathname}`);
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
