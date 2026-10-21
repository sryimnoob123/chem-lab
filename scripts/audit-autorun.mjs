/**
 * 现场口径验证：点右侧"自动"，让它自己跑完整个实验，然后读报告页分数。
 * 同时抓出 "1/4" 这个数字出自哪个元素。
 *
 * 用法：node scripts/audit-autorun.mjs [exp01]
 */
import { chromium } from "@playwright/test";
import { dismissOnboarding, loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const expId = process.argv[2] ?? "exp01";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
await loginStudent(page, { base: BASE });
await page.goto(`${BASE}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await dismissOnboarding(page, { waitMs: 800 });

// "1/4" 出自哪里
const where = await page.evaluate(() => {
  const hits = [];
  const walk = (el) => {
    for (const node of el.children) {
      const t = node.textContent ?? "";
      if (/\d+\s*\/\s*4/.test(t) && node.children.length <= 2 && t.length < 40) {
        hits.push({
          tag: node.tagName,
          cls: typeof node.className === "string" ? node.className.slice(0, 40) : "",
          text: t.replace(/\s+/g, " ").trim().slice(0, 40),
        });
      }
      walk(node);
    }
  };
  walk(document.body);
  return hits.slice(0, 6);
});

// 点"自动"，等它跑完
const autoBtn = page.locator("[data-demo-id='demo-mode-auto']");
await autoBtn.click();
const started = Date.now();
let done = false;
while (Date.now() - started < 180_000) {
  const state = await page.evaluate(() => ({
    text: document.body.innerText.slice(0, 200),
    url: location.href,
  }));
  if (/交卷|已完成|查看报告/.test(state.text) || state.url.includes("/report")) {
    done = true;
    break;
  }
  await page.waitForTimeout(2500);
}

// 找报告入口
const afterRun = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, a")].map((b) => ({
    text: (b.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 12),
    demoId: b.getAttribute("data-demo-id"),
    href: b.getAttribute("href"),
  }));
  return btns.filter((b) => /报告|交卷|完成/.test(b.text) || (b.href ?? "").includes("report")).slice(0, 8);
});

console.log("1/4 出处:", JSON.stringify(where, null, 2));
console.log("auto 跑完:", done, "用时(s):", Math.round((Date.now() - started) / 1000));
console.log("报告入口:", JSON.stringify(afterRun, null, 2));
await page.screenshot({ path: "public/shots-prod/redteam/r6-autorun-end.png" });
await browser.close();
