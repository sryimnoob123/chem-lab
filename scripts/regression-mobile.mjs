/**
 * 移动端视口（390×844）横向溢出与控制台检查，覆盖六个主要页面。
 * 用法：PLAYWRIGHT_BROWSERS_PATH=… BASE_URL=http://localhost:3001 node scripts/regression-mobile.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const EVID = "evidence/regression";
fs.mkdirSync(EVID, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror:" + e.message.slice(0, 120)));
page.on("console", (m) => m.type() === "error" && errs.push("console:" + m.text().slice(0, 120)));

const rows = [];
const check = async (name, url) => {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const m = await page.evaluate(() => {
    const de = document.documentElement;
    const overflow = de.scrollWidth - de.clientWidth;
    // 找出真正超宽的元素，便于定位（排除 svg 内部装饰）
    const wide = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.right > de.clientWidth + 2 && r.width > 40 && getComputedStyle(el).position !== "fixed";
      })
      .slice(0, 3)
      .map((el) => `${el.tagName}.${String(el.getAttribute("class")).slice(0, 24)}@${Math.round(el.getBoundingClientRect().right)}`);
    // 主操作按钮的触控区
    const small = [...document.querySelectorAll("button, a.btn, [role='button']")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.height < 40;
      })
      .slice(0, 4)
      .map((el) => `${(el.innerText || "").trim().slice(0, 8)}:${Math.round(el.getBoundingClientRect().height)}`);
    return { overflow, wide, small };
  });
  rows.push({ name, url: url.replace(BASE, ""), ...m });
  await page.screenshot({ path: `${EVID}/m-${name}.png` });
  console.log(`${m.overflow <= 1 ? "[OK]" : "[FAIL]"} ${name} · 溢出 ${m.overflow}px · ${m.wide.join(" ") || "-"} · 矮按钮 ${m.small.join(" ") || "无"}`);
};

await check("home", BASE + "/");
await check("login", BASE + "/login");
await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
await page.locator("[data-demo-id='demo-login-submit']").click();
await page.waitForURL(/\/experiments/, { timeout: 12000 });
await check("catalog", BASE + "/experiments");
await check("exp01", BASE + "/exp/exp01?force=1");
await check("plan", BASE + "/plan");
await check("teacher", BASE + "/teacher");

console.log("console/pageerror:", errs.length, errs.slice(0, 4));
fs.writeFileSync(`${EVID}/results-mobile.json`, JSON.stringify({ rows, errs }, null, 1));
const bad = rows.filter((r) => r.overflow > 1).length;
await b.close();
process.exitCode = bad || errs.length ? 1 : 0;
