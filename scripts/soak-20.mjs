/**
 * 20 轮循环浸泡：登录 → 实验 → 操作 → 交卷 → 退出
 * 记录每轮堆占用与 pageerror，判断泄漏。
 *
 * 用法：BASE_URL=http://localhost:3001 node scripts/soak-20.mjs [轮数=20]
 * 产物：evidence/soak/summary.json
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const rounds = Number(process.argv[2] ?? 20);
const dir = path.join("evidence", "soak");
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 140)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/Failed to load resource/.test(t) && /(400|401|403|404)/.test(t)) return;
  errors.push("console:" + t.slice(0, 120));
});

const cdp = await ctx.newCDPSession(page);
const heapMB = async () => {
  await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
  const { usedSize } = await cdp.send("Runtime.getHeapUsage");
  return +(usedSize / 1024 / 1024).toFixed(1);
};

const rows = [];
const t0 = Date.now();

const login = async () => {
  await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
  await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
  await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
  await page.locator("[data-demo-id='demo-login-submit']").click();
  await page.waitForURL(/\/experiments/, { timeout: 20000 });
};

for (let i = 1; i <= rounds; i++) {
  const h0 = await heapMB();
  const before = errors.length;
  let ok = true;
  let step = "";
  try {
    step = "登录";
    await login();
    step = "进实验";
    await page.goto(base + "/exp/exp09", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    const op = page.locator("[data-demo-id='demo-op-step1-weigh']").first();
    if (await op.count()) {
      step = "操作";
      await op.click();
      await page.waitForTimeout(500);
    }
    step = "交卷";
    const fin = page.locator("[data-demo-id='demo-finish']").first();
    if (await fin.count()) {
      await fin.click();
      await page.waitForTimeout(1500);
    }
    step = "退出";
    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
  } catch (e) {
    ok = false;
    console.log(`  第 ${i} 轮失败于「${step}」: ${String(e).slice(0, 90)}`);
  }
  const h1 = await heapMB();
  rows.push({ round: i, ok, heapMB: h1, deltaMB: +(h1 - h0).toFixed(1), newErrors: errors.length - before });
  console.log(
    `[${String(i).padStart(2)}/${rounds}] ${ok ? "OK" : "NG"} 堆 ${h1.toFixed(1)}MB (Δ${(h1 - h0).toFixed(1)}) 新错误 ${errors.length - before} 耗时 ${Math.round((Date.now() - t0) / 1000)}s`,
  );
}

await browser.close();

const uniq = [...new Set(errors)];
const heaps = rows.map((r) => r.heapMB);
const growth = heaps.length > 1 ? heaps[heaps.length - 1] - heaps[0] : 0;
const failed = rows.filter((r) => !r.ok).length;
// 判泄漏：忽略第一轮（冷启动），看后半段是否持续单调上升且总增长 > 30MB
const tail = heaps.slice(Math.floor(heaps.length / 2));
const tailGrowth = tail.length > 1 ? tail[tail.length - 1] - tail[0] : 0;

const summary = {
  base,
  rounds,
  ok: failed === 0 && uniq.length === 0,
  failedRounds: failed,
  heap: { series: heaps, growth, tailGrowth },
  errors: uniq,
  rows,
};
fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2));

console.log(`\n===== 浸泡总结 =====`);
console.log(`轮数 ${rounds} · 失败轮 ${failed} · pageerror ${uniq.length} 条`);
console.log(`堆序列: ${heaps.join(" → ")}`);
console.log(`首尾增量 ${growth.toFixed(1)}MB · 后半段增量 ${tailGrowth.toFixed(1)}MB（判泄漏阈值 >30MB 持续上升）`);
if (uniq.length) console.log("错误:", uniq.slice(0, 5).join(" | "));
console.log(`退出码判定: ${summary.ok && tailGrowth < 30 ? "通过" : "需复查"}`);
console.log("明细:", path.join(dir, "summary.json"));
process.exitCode = summary.ok && tailGrowth < 30 ? 0 : 1;
