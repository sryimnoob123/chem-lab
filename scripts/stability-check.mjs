/**
 * 稳态专项（dev:3000）
 *   门户 -> 登录 -> 选实验 -> 实验页：每页连点 20 次
 *   快速切页 / 前进后退 / 刷新：各 30 次
 *   实验中途刷新、中途后退
 *   连跑 3 轮，heapUsed 增量 < 50MB
 * 断言：pageerror=0、无未捕获 promise 拒绝、无白屏、无横向溢出
 *
 * 用法：node scripts/stability-check.mjs
 * 证据：%TEMP%\chemlab-shots\stability\<轮次>-<场合>.png
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const base = "http://localhost:3000";
const dir = path.join(os.tmpdir(), "chemlab-shots", "stability");
fs.mkdirSync(dir, { recursive: true });

const ROUTES = ["/", "/login", "/experiments", "/exp/exp09"];
const ROUNDS = 3;
const CLICKS = 20;
const SWITCHES = 30;

const errors = [];
const unhandled = [];
const shots = [];
let failures = 0;

const fail = (k, d) => {
  failures += 1;
  console.log(`[X ] ${k} · ${d}`);
};
const ok = (k, d = "") => console.log(`[OK] ${k}${d ? " · " + d : ""}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();

await page.addInitScript(() => {
  window.__unhandled = [];
  window.addEventListener("unhandledrejection", (e) => {
    window.__unhandled.push(String(e.reason).slice(0, 200));
  });
});
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console:" + m.text().slice(0, 140));
});

const cdp = await ctx.newCDPSession(page);
const heapMB = async () => {
  await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
  const { usedSize } = await cdp.send("Runtime.getHeapUsage");
  return usedSize / 1024 / 1024;
};

/** 白屏 / 错位检查；返回问题列表 */
const inspect = async (where, tag) => {
  const problems = [];
  const info = await page.evaluate(() => {
    const de = document.documentElement;
    return {
      textLen: (document.body?.innerText ?? "").replace(/\s+/g, "").length,
      scrollW: de.scrollWidth,
      clientW: de.clientWidth,
      url: location.pathname,
      unhandled: window.__unhandled ?? [],
    };
  });
  if (info.textLen < 30) problems.push(`白屏(textLen=${info.textLen})`);
  if (info.scrollW - info.clientW > 2) problems.push(`横向溢出(${info.scrollW}>${info.clientW})`);
  if (info.unhandled.length) {
    unhandled.push(...info.unhandled);
    await page.evaluate(() => {
      window.__unhandled = [];
    });
  }
  if (problems.length) {
    const file = path.join(dir, `${tag}-${where.replace(/[^\w]/g, "_")}.png`);
    await page.screenshot({ path: file, fullPage: false });
    shots.push(file);
    fail(`${where}`, problems.join(" / "));
  }
  return problems.length;
};

const login = async () => {
  await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
  await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
  await page.locator("[data-demo-id='demo-login-submit']").click();
  await page.waitForTimeout(1200);
};

await login();

const heaps = [];
for (let round = 1; round <= ROUNDS; round++) {
  console.log(`\n===== 第 ${round} 轮 =====`);
  const h0 = await heapMB();

  // 1) 每页连点 20 次
  for (const route of ROUTES) {
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    for (let i = 0; i < CLICKS; i++) {
      // 点在页面中部与两侧，避开会提交表单的主按钮；不移动鼠标出视口
      const x = 240 + ((i * 137) % 900);
      const y = 200 + ((i * 89) % 520);
      await page.mouse.click(x, y).catch(() => {});
    }
    await page.waitForTimeout(200);
    await inspect(`round${round}-click-${route}`, "click");
  }
  ok(`连点 ${ROUTES.length} 页 × ${CLICKS} 次`);

  // 2) 快速切页 30 次
  for (let i = 0; i < SWITCHES; i++) {
    const route = ROUTES[i % ROUTES.length];
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
  }
  await inspect(`round${round}-switch`, "switch");
  ok(`快速切页 ${SWITCHES} 次`);

  // 3) 前进后退 30 次
  for (let i = 0; i < SWITCHES; i++) {
    if (i % 2 === 0) await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
    else await page.goForward({ waitUntil: "domcontentloaded" }).catch(() => {});
  }
  await inspect(`round${round}-history`, "history");
  ok(`前进后退 ${SWITCHES} 次`);

  // 4) 刷新 30 次（含实验中途）
  for (let i = 0; i < SWITCHES; i++) {
    const route = i % 3 === 0 ? "/exp/exp09" : ROUTES[i % ROUTES.length];
    await page.goto(base + route, { waitUntil: "domcontentloaded" });
    if (route === "/exp/exp09") {
      // 中途操作一下再刷新
      const btn = page.locator("[data-demo-id^='demo-op-step']").first();
      if (await btn.count()) await btn.click().catch(() => {});
    }
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  await inspect(`round${round}-reload`, "reload");
  ok(`刷新 ${SWITCHES} 次（含实验中途）`);

  // 5) 实验中途后退
  await page.goto(base + "/exp/exp09", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const op = page.locator("[data-demo-id^='demo-op-step']").first();
  if (await op.count()) await op.click().catch(() => {});
  await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
  await inspect(`round${round}-mid-back`, "midback");
  ok("实验中途后退");

  const h1 = await heapMB();
  heaps.push(h1);
  console.log(`  堆：${h0.toFixed(1)} -> ${h1.toFixed(1)} MB（Δ ${(h1 - h0).toFixed(1)}）`);
}

await browser.close();

// ---- 汇总断言 ----
const uniqueErrors = [...new Set(errors)];
const uniqueUnhandled = [...new Set(unhandled)];
const growth = heaps.length > 1 ? heaps[heaps.length - 1] - heaps[0] : 0;

console.log("\n===== 汇总 =====");
console.log(`pageerror / console.error: ${uniqueErrors.length} 条`);
if (uniqueErrors.length) console.log("  " + uniqueErrors.slice(0, 6).join("\n  "));
console.log(`未捕获 promise 拒绝: ${uniqueUnhandled.length} 条`);
if (uniqueUnhandled.length) console.log("  " + uniqueUnhandled.slice(0, 4).join("\n  "));
console.log(`堆序列: ${heaps.map((h) => h.toFixed(1)).join(" → ")} MB，首尾增量 ${growth.toFixed(1)} MB（阈值 50）`);
console.log(`白屏/错位截图: ${shots.length} 张${shots.length ? "\n  " + shots.join("\n  ") : ""}`);

const passNoErr = uniqueErrors.length === 0;
const passNoUnhandled = uniqueUnhandled.length === 0;
const passHeap = growth < 50;
if (!passNoErr) fail("pageerror", `${uniqueErrors.length} 条`);
if (!passNoUnhandled) fail("unhandledRejection", `${uniqueUnhandled.length} 条`);
if (!passHeap) fail("内存", `增量 ${growth.toFixed(1)} MB`);

console.log(
  `\n结论：${failures === 0 ? "全部通过" : `失败 ${failures} 项`}（pageerror ${passNoErr ? "OK" : "NG"} / promise ${passNoUnhandled ? "OK" : "NG"} / 内存 ${passHeap ? "OK" : "NG"}）`,
);
process.exitCode = failures === 0 ? 0 : 1;
