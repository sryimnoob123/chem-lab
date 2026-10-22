#!/usr/bin/env node
/** 找出页面上落在 4 级字阶之外的字号（报元素选择器，方便定点修） */
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const routes = process.argv.slice(2);
if (!routes.length) routes.push("/", "/login", "/exp/exp01?force=1", "/plan", "/exp/exp01/report", "/teacher");

const OK = new Set([12, 14, 20, 32]);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });

for (const route of routes) {
  const page = await ctx.newPage();
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const out = await page.evaluate((ok) => {
    const off = [];
    for (const el of document.querySelectorAll("body *")) {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") continue;
      const txt = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join("");
      if (!txt) continue;
      const fs = Math.round(parseFloat(s.fontSize));
      if (ok.includes(fs) || fs >= 40) continue;
      off.push({
        fs,
        sel: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0, 2).join(".") : ""),
        txt: txt.slice(0, 26),
      });
    }
    return off;
  }, [...OK]);
  const seen = new Set();
  console.log(`\n== ${route}  (${out.length} 处偏档)`);
  for (const o of out) {
    const k = o.fs + o.sel;
    if (seen.has(k)) continue;
    seen.add(k);
    console.log(`   ${o.fs}px  ${o.sel}  «${o.txt}»`);
  }
  await page.close();
}
await browser.close();
