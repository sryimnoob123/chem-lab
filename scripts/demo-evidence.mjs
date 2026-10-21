/**
 * 一键演示全程跑 + 截图取证
 * 覆盖：门户 → 登录 → 选实验 → 实验页 → 失败分支 → 重做 → 成功 → 交卷 → 报告 → 事故大秀 → 教师端
 * 同时验证：暂停 / 继续 / 退出 / 重来 / 演示期间是否产生写库请求
 *
 * 用法：node scripts/demo-evidence.mjs [最长秒=200]
 * 产物：evidence/demo/<序号>-<场景>.png + summary.json
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const limit = Number(process.argv[2] ?? 200);
const dir = path.join("evidence", "demo");
fs.mkdirSync(dir, { recursive: true });

const base = process.env.BASE_URL ?? "http://localhost:3001";
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
const errors = [];
const writes = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
page.on("request", (r) => {
  if (r.method() !== "GET" && /\/api\/(runs|finish)/.test(r.url())) writes.push(`${r.method()} ${new URL(r.url()).pathname}`);
});

await page.goto(base + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(dir, "00-portal.png") });

const btn = page.locator("[data-demo-id='demo-mode-open']").first();
const label = (await btn.innerText()).replace(/\s+/g, " ").trim();
await btn.click();
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(dir, "01-overlay-open.png") });

const t0 = Date.now();
const scenes = [];
const caps = new Set();
let lastSrc = "";
let shot = 2;
let failureShot = false;
let retryShot = false;
let pausedChecked = false;

while ((Date.now() - t0) / 1000 < limit) {
  await page.waitForTimeout(700);
  const src = await page.locator(".demo-frame__iframe").getAttribute("src").catch(() => "");
  const cap = await page.locator(".demo-caption__text").innerText().catch(() => "");
  const state = await page.locator(".demo-bar__state").innerText().catch(() => "");

  if (cap) caps.add(cap);
  if (/失败分支/.test(cap) && !failureShot) {
    failureShot = true;
    await page.screenshot({ path: path.join(dir, "05-failure-branch.png") });
  }
  if (/重做本步/.test(cap) && !retryShot) {
    retryShot = true;
    await page.screenshot({ path: path.join(dir, "06-retry.png") });
  }
  if (src && src !== lastSrc) {
    lastSrc = src;
    scenes.push({ t: Math.round((Date.now() - t0) / 1000), src });
    const name = src.split("/").filter(Boolean).join("-").replace(/[?=&]+/g, "-").slice(0, 40) || "portal";
    await page.screenshot({ path: path.join(dir, `${String(shot++).padStart(2, "0")}-${name}.png`) });

    // 第一次进入实验页时验证暂停/继续
    if (/exp09/.test(src) && !pausedChecked) {
      pausedChecked = true;
      await page.waitForTimeout(1500);
      await page.locator("button:has-text('暂停')").first().click().catch(() => {});
      await page.waitForTimeout(600);
      const paused = (await page.locator(".demo-bar__state").innerText().catch(() => "")).trim();
      await page.screenshot({ path: path.join(dir, "0X-paused.png") });
      await page.locator("button:has-text('继续')").first().click().catch(() => {});
      await page.waitForTimeout(400);
      const resumed = (await page.locator(".demo-bar__state").innerText().catch(() => "")).trim();
      scenes.push({ t: -1, src: `pause:${paused}→${resumed}` });
    }
  }
  if (scenes.filter((s) => s.t >= 0).length >= 7 && caps.size > 18) break;
}

// 退出
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
const closedByEsc = (await page.locator(".demo-overlay").count()) === 0;
const scrollOk = await page.evaluate(() => getComputedStyle(document.body).overflow !== "hidden");

// 重来
await btn.click();
await page.waitForTimeout(600);
await page.locator("[data-demo-id='demo-mode-restart']").click();
await page.waitForTimeout(2000);
const restartSrc = await page.locator(".demo-frame__iframe").getAttribute("src").catch(() => "");
await page.screenshot({ path: path.join(dir, "99-restart.png") });
await page.locator("[data-demo-id='demo-mode-exit']").click();
await page.waitForTimeout(300);

await b.close();

const summary = {
  buttonLabel: label,
  scenes: scenes.filter((s) => s.t >= 0),
  pauseResult: scenes.find((s) => s.t === -1)?.src ?? "未测到",
  captions: caps.size,
  failureBranchShown: failureShot,
  retryShown: retryShot,
  closedByEsc,
  scrollRestored: scrollOk,
  restartSrc,
  writeRequests: [...new Set(writes)],
  pageErrors: [...new Set(errors)],
};
fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2));

console.log("\n=== 一键演示 ===");
console.log("按钮文字:", label);
console.log("场景:", summary.scenes.map((s) => `${s.t}s ${s.src.replace(base, "")}`).join(" → "));
console.log("暂停/继续:", summary.pauseResult);
console.log("旁白条数:", summary.captions);
console.log("失败分支截图:", failureShot, "| 重做截图:", retryShot);
console.log("Esc 可退出:", closedByEsc, "| 页面恢复滚动:", scrollOk);
console.log("重来回到:", restartSrc);
console.log("演示期间的写库请求:", summary.writeRequests.length ? summary.writeRequests.join(", ") : "无");
console.log("pageerror:", summary.pageErrors.length ? summary.pageErrors.join(" | ") : 0);
console.log("\n截图目录:", dir);
