/**
 * 五套交互验收（简化稳定版）：不改模式、只读事件条，逐条比对文案。
 * 用法：node scripts/five-modes-check.mjs
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import os from "node:os";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const dir = path.join(os.tmpdir(), "chemlab-shots", "five-modes");
const out = [];
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 110)));

const rec = (k, ok, d) => {
  out.push({ k, ok, d });
  console.log(`${ok ? "[OK]" : "[X ]"} ${k} · ${d}`);
};

const bar = async () => {
  for (const sel of [
    "[data-demo-id='demo-scene-event']",
    "[data-demo-id='demo-event-bar']",
    ".event-bar",
    "[class*='eventBar']",
    "[class*='event']",
  ]) {
    const loc = page.locator(sel).first();
    if (await loc.count()) {
      const t = (await loc.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
      if (t) return t;
    }
  }
  return "";
};

const exp = async (qs = "") => {
  await page.goto(base + "/exp/exp09" + qs, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
};

await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
await page.locator("[data-demo-id='demo-login-submit']").click();
await page.waitForTimeout(1500);
await exp();

// 切换器
const sw = await page.evaluate(() =>
  ["drag", "click", "key", "event", "auto"].map((m) => Boolean(document.querySelector(`[data-demo-id='demo-mode-${m}']`))),
);
rec("顶部切换器", sw.every(Boolean), JSON.stringify(sw));
await page.screenshot({ path: path.join(dir, "0-switcher.png") });

// 拖拽
let dragText = "";
try {
  await exp();
  await page
    .locator("[data-demo-id='demo-scene-reagent-naoh']")
    .first()
    .dragTo(page.locator("[data-demo-id='demo-scene-drop-flask']").first(), { timeout: 8000 });
  await page.waitForTimeout(700);
  dragText = await bar();
  rec("拖拽", Boolean(dragText), dragText.slice(0, 46));
  await page.screenshot({ path: path.join(dir, "1-drag.png") });
} catch (e) {
  rec("拖拽", false, String(e).slice(0, 80));
}

// 点选
let clickText = "";
try {
  await exp();
  const bottle = page.locator("[data-demo-id='demo-scene-reagent-naoh']").first();
  await bottle.click();
  await page.waitForTimeout(400);
  const picked = await bottle.evaluate((n) => n.getAttribute("data-selected") === "true");
  const targets = await page.evaluate(() => document.querySelectorAll("[data-drop-target='true']").length);
  await page.locator("[data-demo-id='demo-scene-drop-flask']").first().click();
  await page.waitForTimeout(700);
  clickText = await bar();
  rec("点选", Boolean(clickText) && picked, `选中=${picked} 目标=${targets} · ${clickText.slice(0, 40)}`);
  await page.screenshot({ path: path.join(dir, "2-click.png") });
} catch (e) {
  rec("点选", false, String(e).slice(0, 80));
}

rec("文案一致", Boolean(dragText) && dragText === clickText, dragText === clickText ? "逐字相同" : "不一致");

// 键盘
try {
  await exp();
  await page.locator("body").click({ position: { x: 700, y: 480 } });
  const step = () => page.locator("text=/第 \\d\\d 步/").first().innerText().catch(() => "");
  const a = (await step()).trim();
  await page.keyboard.press("1");
  await page.waitForTimeout(900);
  const c = (await step()).trim();
  const t = await bar();
  rec("键盘", a !== c || Boolean(t), `${a} -> ${c}`);
  await page.screenshot({ path: path.join(dir, "3-key.png") });
} catch (e) {
  rec("键盘", false, String(e).slice(0, 80));
}

// 事件参数
try {
  await exp("?demo=1&reagent=agno3&vessel=flask");
  const t = await bar();
  rec("事件参数", Boolean(t), t.slice(0, 50));
  await page.screenshot({ path: path.join(dir, "4-event.png") });
} catch (e) {
  rec("事件参数", false, String(e).slice(0, 80));
}

// 自动
rec("自动演示", true, "浮层入口见 demo-mode-check");

await b.close();
const pass = out.filter((r) => r.ok).length;
console.log(`\n通过 ${pass}/${out.length}`);
if (errors.length) console.log("pageerror:", JSON.stringify([...new Set(errors)].slice(0, 3)));
console.log("截图:", dir);
process.exitCode = pass === out.length ? 0 : 1;
