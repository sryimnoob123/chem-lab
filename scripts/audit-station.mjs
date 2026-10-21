/**
 * 全站巡检：主要路由 200 / 非空白 / 控制台无 error / 内部链接无死链
 * + 提示灯泡按钮点测
 * 用法：node scripts/audit-station.mjs
 */
import { chromium } from "@playwright/test";
import { loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();

const consoleErrors = [];
const pageErrors = [];
/** 带上发起请求的 URL，否则 401/403 分不清是哪个接口 */
page.on("response", (res) => {
  const s = res.status();
  if (s >= 400 && s !== 404) consoleErrors.push(`${s} ${res.url().replace(BASE, "")}`);
});
page.on("console", (m) => {
  if (m.type() === "error") {
    const t = m.text().slice(0, 140);
    // 过滤浏览器自身的资源告警（favicon 等）；4xx 已由 response 钩子记全 URL
    if (!/favicon|Failed to load resource/.test(t)) {
      consoleErrors.push(t);
    }
  }
});
page.on("pageerror", (e) => pageErrors.push(String(e.message).slice(0, 140)));

await loginStudent(page, { base: BASE });

const ROUTES = [
  "/",
  "/login",
  "/experiments",
  "/experiments?unlock=all",
  "/teacher",
  "/exp/exp01?force=1",
  "/exp/exp03?force=1",
  "/exp/exp09?force=1",
  "/exp/exp01/report",
  "/exp/exp09/report",
  "/dev",
];
const rows = [];
for (const r of ROUTES) {
  const resp = await page.goto(`${BASE}${r}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  const info = await page.evaluate(() => ({
    textLen: document.body.innerText.replace(/\s+/g, "").length,
    hasMain: !!document.querySelector("main, [role='main']"),
    title: document.title.slice(0, 40),
    links: [...document.querySelectorAll("a[href^='/']")].map((a) => a.getAttribute("href")).slice(0, 40),
    /** 真正的"非空白"判据：有可点/可交互元素或 svg 场景，不是只有一句提示 */
    interactive: document.querySelectorAll(
      "button, input, select, textarea, [data-demo-id], svg, canvas",
    ).length,
  }));
  rows.push({ route: r, status: resp?.status() ?? null, ...info, links: info.links.length });
  // 死链检查
  const bad = [];
  for (const href of new Set(info.links)) {
    if (!href || href.startsWith("/#")) continue;
    const res = await page.request.get(`${BASE}${href}`, { maxRedirects: 0 }).catch(() => null);
    if (!res) {
      bad.push({ href, status: "failed" });
      continue;
    }
    const s = res.status();
    if (s >= 400) bad.push({ href, status: s });
  }
  if (bad.length) rows[rows.length - 1].deadLinks = bad;
}

// 提示灯泡按钮
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
const skip = page.locator("button:has-text('跳过，直接开始')");
if (await skip.count()) {
  await skip.first().click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(700);
}
const hintBtn = page.locator("[data-demo-id='demo-hint-button']");
const hint = { found: await hintBtn.count() };
if (hint.found) {
  const before = await page.evaluate(() => document.body.innerText.includes("H1") || document.body.innerText.includes("提示："));
  await hintBtn.first().click({ force: true }).catch(() => undefined);
  await page.waitForTimeout(1200);
  hint.afterClick = await page.evaluate(() => {
    const body = document.body.innerText;
    const m = body.match(/H([0-3])\s*[·:：]?\s*([^\n]{0,40})/);
    return { hasLevel: /H[0-3]/.test(body), snippet: m ? m[0] : body.slice(0, 60) };
  });
  hint.changed = hint.afterClick.hasLevel !== before;
  const box = await hintBtn.first().boundingBox();
  hint.size = box ? { w: Math.round(box.width), h: Math.round(box.height) } : null;
}
await page.screenshot({ path: "public/shots-prod/redteam/hint-button.png" });

console.log(JSON.stringify({ rows, hint, consoleErrors: consoleErrors.slice(0, 6), pageErrors: pageErrors.slice(0, 6) }, null, 2));
await browser.close();
