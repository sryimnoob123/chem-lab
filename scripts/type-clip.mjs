#!/usr/bin/env node
/**
 * 文字被裁检测：元素 scrollWidth/scrollHeight 明显大于 clientWidth/clientHeight，
 * 且 overflow 是 hidden/clip —— 这类「文字断在框里」肉眼扫全站最容易漏。
 *
 * 用法：node scripts/type-clip.mjs [route...]
 */
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const routes = process.argv.slice(2);
if (!routes.length) routes.push("/", "/login", "/exp/exp01?force=1", "/plan", "/exp/exp01/report", "/teacher");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });

for (const route of routes) {
  const page = await ctx.newPage();
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1600);
  const hits = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const s = getComputedStyle(el);
      const txt = (el.innerText || "").trim();
      if (!txt || txt.length < 3) continue;
      const ov = s.overflowX;
      const clippedX = el.scrollWidth - el.clientWidth > 2 && (ov === "hidden" || ov === "clip");
      const clippedY = el.scrollHeight - el.clientHeight > 2 && (s.overflowY === "hidden" || s.overflowY === "clip") && !s.overflowY.includes("auto");
      if (!clippedX && !clippedY) continue;
      out.push({
        sel: el.tagName.toLowerCase() + "." + String(el.className || "").split(" ").slice(0, 2).join("."),
        dx: el.scrollWidth - el.clientWidth,
        dy: el.scrollHeight - el.clientHeight,
        txt: txt.replace(/\s+/g, " ").slice(0, 46),
      });
    }
    return out;
  });
  console.log(`\n== ${route}  被裁 ${hits.length} 处`);
  for (const h of hits.slice(0, 14)) console.log(`   dx=${h.dx} dy=${h.dy}  ${h.sel}  «${h.txt}»`);
  await page.close();
}
await browser.close();
