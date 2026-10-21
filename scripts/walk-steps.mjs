/**
 * 自动走完 7 步：每步依次试 demo-op-stepN-* 直到步数推进，记录正确选项 id。
 * 产出：控制台打印一条可直接写进演示脚本的序列。
 *
 * 用法：node scripts/walk-steps.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const base = "http://localhost:3000";
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));

// 登录
await page.goto(base + "/login", { waitUntil: "networkidle" });
await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
await page.locator("[data-demo-id='demo-login-submit']").click();
await page.waitForURL(/\/experiments/, { timeout: 8000 });
await page.goto(base + "/exp/exp09", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const stepOf = async () => {
  const t = await page.locator("text=/第 \\d\\d 步/").first().innerText().catch(() => "第 01 步");
  const m = t.match(/第\s*(\d+)\s*步/);
  return m ? Number(m[1]) : 0;
};

const seq = [];
for (let guard = 0; guard < 40; guard++) {
  const cur = await stepOf();
  if (cur >= 7) break;
  const ids = await page.evaluate((n) =>
    Array.from(document.querySelectorAll(`[data-demo-id^="demo-op-step${n}-"]`)).map((el) =>
      el.getAttribute("data-demo-id"),
    ),
    cur,
  );
  if (!ids.length) {
    console.log(`第 ${cur} 步没有可点选项，停`);
    break;
  }
  let advanced = false;
  for (const id of ids) {
    const el = page.locator(`[data-demo-id='${id}']`).first();
    await el.scrollIntoViewIfNeeded();
    await el.click();
    await page.waitForTimeout(700);
    if ((await stepOf()) > cur) {
      seq.push({ step: cur, id });
      console.log(`第 ${cur} 步 ✓ ${id}`);
      advanced = true;
      break;
    }
  }
  if (!advanced) {
    console.log(`第 ${cur} 步所有选项都没推进（可能是末端步骤），停`);
    break;
  }
}

// 交卷 → 报告
const finish = page.locator("[data-demo-id='demo-finish']").first();
if (await finish.count()) {
  await finish.click();
  await page.waitForTimeout(1800);
}
const url = page.url();
const shot = path.join(os.tmpdir(), "chemlab-shots", "walk-end.png");
await page.screenshot({ path: shot, fullPage: true });
const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 260);

await b.close();
console.log("\n序列:", JSON.stringify(seq.map((s) => s.id)));
console.log("结束 URL:", url);
console.log("报告文本:", text);
console.log("截图:", shot);
if (errors.length) console.log("pageerror:", JSON.stringify([...new Set(errors)].slice(0, 3)));
