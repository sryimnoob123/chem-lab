/**
 * ⑤ 2.5D 质感实测：玻璃三层高光 / 液体垂直渐变 / 液面高光 / 气泡 / 每实验主色。
 * 对 DOM 直接取 SVG 结构与 computed style，并截图。
 * 产物：%TEMP%\chemlab-shots\20261022-pm\2p5d-*.png
 * 用法：node .team/texture-2p5d-check.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const SHOTS = join(tmpdir(), "chemlab-shots", "20261022-pm");
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const rows = [];
const problems = [];

for (const expId of ["exp01", "exp03", "exp09"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.request.post(`${BASE}/api/session`, {
    headers: { "content-type": "application/json" },
    data: { studentNo: "20250101", name: "周若曦" },
  });
  await page.goto(`${BASE}/exp/${expId}?force=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /跳过/ }).first().click().catch(() => {});
  await page.waitForTimeout(600);

  // 往锥形瓶拖一瓶试剂，让液体出现（先点建议动作到能投加的步，找不到就直接拖水）
  const flask = page.locator('[data-demo-id="demo-scene-drop-flask"]').first();
  const water = page.locator('[data-demo-id="demo-scene-reagent-water"]').first();
  const wb = await water.boundingBox().catch(() => null);
  const fb = await flask.boundingBox().catch(() => null);
  if (wb && fb) {
    await page.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      await page.mouse.move(
        wb.x + (fb.x - wb.x) * t + wb.width / 2,
        wb.y + (fb.y - wb.y) * t + wb.height / 2 - Math.sin(t * Math.PI) * 20,
      );
      await page.waitForTimeout(40);
    }
    await page.mouse.up();
    await page.waitForTimeout(1500);
  }

  const dom = await page.evaluate(() => {
    const gradients = [...document.querySelectorAll("svg linearGradient")].map((g) => ({
      id: g.id,
      x1: g.getAttribute("x1"),
      y1: g.getAttribute("y1"),
      x2: g.getAttribute("x2"),
      y2: g.getAttribute("y2"),
      stops: [...g.querySelectorAll("stop")].map((s) => `${s.getAttribute("offset")}@${s.getAttribute("stop-opacity") ?? "1"}`),
    }));
    // 玻璃要三层：填充色层 + 高光细线 + 底部反光
    const paths = [...document.querySelectorAll("svg path, svg ellipse")].map((el) => el.getAttribute("class") ?? "");
    const cls = paths.join(" ");
    const ellipses = document.querySelectorAll("svg ellipse").length;
    const circles = document.querySelectorAll("svg circle").length;
    // 主色：从实验台容器继承的 --exp-accent
    const host = document.querySelector("[data-exp]") ?? document.body;
    const accent = getComputedStyle(host).getPropertyValue("--exp-accent").trim();
    const accentScope = host.getAttribute("data-exp");
    return {
      gradients,
      hasSheen: /sheen/i.test(cls),
      hasReflect: /reflect/i.test(cls),
      hasGlassShape: /glassShape/i.test(cls),
      ellipses,
      circles,
      accent,
      accentScope,
    };
  });

  const vertical = dom.gradients.find((g) => g.x1 === "0" && g.y1 === "0" && g.x2 === "0" && g.y2 === "1");
  const shotPath = join(SHOTS, `2p5d-${expId}.png`);
  await page.screenshot({ path: shotPath });

  const checks = [
    ["玻璃三层（填充 + sheen 高光 + 底部反光）", dom.hasGlassShape && dom.hasSheen && dom.hasReflect],
    ["液体垂直渐变（x1=0,y1=0 → x2=0,y2=1 且多档 stop）", Boolean(vertical && vertical.stops.length >= 2)],
    ["液面高光（椭圆描边 ≥2 层）", dom.ellipses >= 2],
    ["气泡（circle 元素存在）", dom.circles >= 1],
    [`实验主色 --exp-accent 注入（${dom.accentScope}）`, Boolean(dom.accent) && dom.accentScope === expId],
  ];
  for (const [name, ok] of checks) {
    rows.push({ 项: `${expId} · ${name}`, 结果: ok ? "PASS" : "FAIL", 说明: ok ? "" : "未检出" });
    if (!ok) problems.push(`${expId}: ${name}`);
  }
  rows.push({ 项: `${expId} · 主色值`, 结果: "PASS", 说明: dom.accent, 截图: shotPath });
  await ctx.close();
}

await browser.close();
console.log(`截图目录：${SHOTS}\n`);
console.log("项\t\t\t\t\t\t结果\t说明");
for (const r of rows) console.log(`${r.项}\t${r.结果}\t${r.说明 ?? ""}${r.截图 ? r.截图 : ""}`);
console.log("");
console.log(problems.length === 0 ? "✅ ⑤ 2.5D 全 PASS" : `❌ ${problems.length} 个问题：\n  - ${problems.join("\n  - ")}`);
process.exit(problems.length === 0 ? 0 : 1);
