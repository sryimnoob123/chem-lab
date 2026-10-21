/**
 * 验 Dev Dock 在演示构建里真的能点到，且"一键演示"能跑到报告页。
 * 用法：node scripts/audit-dev-dock.mjs [exp03]
 */
import { chromium } from "@playwright/test";
import { loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const expId = process.argv[2] ?? "exp03";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
await loginStudent(page, { base: BASE });

// 1) Dev Dock 是否渲染（内容可能是折叠的，先展开）
await page.goto(`${BASE}/experiments`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
const toggle = page.locator("[data-dev='dock-toggle']");
if (await toggle.count()) {
  await toggle.first().click().catch(() => undefined);
  await page.waitForTimeout(1200);
}
const dock = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll("[data-dev]")];
  return {
    count: nodes.length,
    ids: [...new Set(nodes.map((n) => n.getAttribute("data-dev")))].slice(0, 12),
    oneclick: nodes.filter((n) => n.getAttribute("data-dev") === "dock-oneclick-demo").length,
    oneclickHref: document.querySelector("[data-dev='dock-oneclick-demo']")?.getAttribute("href") ?? null,
  };
});

// 2) Dev Dock 一键演示 → 报告页
const link = page.locator(`[data-dev='dock-oneclick-demo'][data-exp='${expId}']`);
const hasLink = await link.count();
let flow = null;
if (hasLink) {
  await link.first().click();
  const t0 = Date.now();
  let reachedReport = false;
  for (let i = 0; i < 140; i++) {
    await page.waitForTimeout(1000);
    if (page.url().includes("/report")) {
      reachedReport = true;
      break;
    }
  }
  await page.waitForTimeout(2500);
  flow = await page.evaluate(() => {
    const body = document.body.innerText.replace(/\s+/g, " ");
    return {
      url: location.href,
      total: (body.match(/总分\s*(\d+)\s*\/\s*100/) ?? [])[1] ?? null,
      badge: body.includes("零事故"),
      hasWrong: /错题解析/.test(body),
      post: (body.match(/后测（\d+ 题）\s*(\d+)\s*\/\s*100/) ?? [])[1] ?? null,
    };
  });
  flow.reachedReport = reachedReport;
  flow.seconds = Math.round((Date.now() - t0) / 1000);
}

// 3) exp03 器皿是否出画
await page.goto(`${BASE}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);
const bounds = await page.evaluate(() => {
  const svg = document.querySelector("[class*='benchReuse'] svg");
  const sb = svg ? svg.getBoundingClientRect() : null;
  const vessels = [...document.querySelectorAll("[data-demo-id^='demo-scene-vessel']")].map((el) => {
    const b = el.getBoundingClientRect();
    return {
      id: el.getAttribute("data-demo-id").replace("demo-scene-vessel-", ""),
      cx: Math.round(b.left + b.width / 2),
      left: Math.round(b.left),
    };
  });
  return {
    svgLeft: sb ? Math.round(sb.left) : null,
    vessels,
    offscreen: vessels.filter((v) => sb && (v.cx < sb.left || v.cx > sb.left + sb.width)),
  };
});

console.log(JSON.stringify({ dock, flow, bounds, errors }, null, 2));
await page.screenshot({ path: "public/shots-prod/redteam/r15-exp03-vessels.png" });
await browser.close();
