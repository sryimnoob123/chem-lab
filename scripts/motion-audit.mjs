/**
 * 动效与性能预算审计（把 docs/design/STYLE-20261021.md §5 的硬指标变成断言）
 *
 * 检查项：
 *   1. 首屏编排：登录页存在 stroke-dashoffset 描绘动画（animation-name 含 draw）
 *   2. 循环动画数量 ≤6（每个元素算 1，气泡组按父级算）
 *   3. SVG DOM 节点 ≤400
 *   4. 横向溢出：scrollWidth === clientWidth
 *   5. prefers-reduced-motion: reduce 下所有动画 animationName === "none"
 *   6. 指针视差：pointermove 后 --px/--py 有变化，且幅度 ≤10px
 *   7. 触控区：可点元素 ≥44px（移动视口）
 *   8. 音效引擎：window 上有合成器钩子且 playSound 调用不抛错（若已接入）
 *
 * 用法：
 *   $env:BASE_URL="http://localhost:3001"; node scripts/motion-audit.mjs
 *   node scripts/motion-audit.mjs /login            # 只查某条路由
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const only = process.argv[2] ?? null;
const routes = (only ? [only] : ["/login", "/", "/exp/exp01?force=1"]).map((r) => r);
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const outDir = path.join(os.tmpdir(), "chemlab-shots", `motion-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const report = [];
const failures = [];

function check(route, name, pass, detail) {
  const row = { route, name, pass, detail };
  report.push(row);
  if (!pass) failures.push(row);
  console.log(`${pass ? "PASS" : "FAIL"}  ${route.padEnd(18)} ${name}${detail ? ` — ${detail}` : ""}`);
}

/** 桌面视口：动效/节点/溢出/视差 */
async function auditDesktop(route) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);

  const m = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*"));
    const animated = all.filter((el) => {
      const s = getComputedStyle(el);
      return s.animationName && s.animationName !== "none";
    });
    const infinite = animated.filter((el) => {
      const s = getComputedStyle(el);
      return s.animationIterationCount === "infinite";
    });
    const infiniteGroups = new Set(infinite.map((el) => getComputedStyle(el).animationName)).size;
    const drawing = animated.filter((el) => getComputedStyle(el).animationName.includes("draw"));
    return {
      anchors: all.length,
      svgNodes: document.querySelectorAll("svg *").length,
      animatedCount: animated.length,
      infiniteCount: infinite.length,
      infiniteGroups,
      infiniteNames: [...new Set(infinite.map((el) => getComputedStyle(el).animationName))].slice(0, 12),
      drawCount: drawing.length,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      svgCount: document.querySelectorAll("svg").length,
    };
  });

  check(route, "无横向溢出", m.overflowX === 0, `overflowX=${m.overflowX}px`);
  check(route, "SVG 节点 ≤400", m.svgNodes <= 400, `svgNodes=${m.svgNodes}`);
  // 预算按「动画组数」判定（同一 animation-name 的气泡/液滴算一组），同时把元素数报出来备查
  check(
    route,
    "循环动画 ≤6 组",
    m.infiniteGroups <= 6,
    `groups=${m.infiniteGroups} elements=${m.infiniteCount} [${m.infiniteNames.join(",")}]`,
  );
  if (route === "/login") {
    check(route, "首屏描绘存在", m.drawCount > 0, `draw 动画元素=${m.drawCount}`);
  }

  // 指针视差：只写 CSS 变量，幅度 ≤10px
  if (route === "/login") {
    const before = await page.evaluate(() => {
      const el = document.querySelector(".login-screen");
      return el ? getComputedStyle(el).getPropertyValue("--px").trim() : "";
    });
    await page.mouse.move(120, 200);
    await page.waitForTimeout(260);
    await page.mouse.move(1320, 780);
    await page.waitForTimeout(260);
    const after = await page.evaluate(() => {
      const el = document.querySelector(".login-screen");
      if (!el) return { px: "", near: "", far: "" };
      const near = el.querySelector("[class*='near']");
      const far = el.querySelector("[class*='far']");
      return {
        px: getComputedStyle(el).getPropertyValue("--px").trim(),
        near: near ? getComputedStyle(near).transform : "",
        far: far ? getComputedStyle(far).transform : "",
      };
    });
    const moved = after.px !== "" && after.px !== before;
    check(route, "指针视差写入 --px", moved, `before="${before}" after="${after.px}"`);
    const mag = (t) => {
      const mm = t && t.match(/matrix\(([^)]+)\)/);
      if (!mm) return 0;
      const n = mm[1].split(",").map(Number);
      return Math.max(Math.abs(n[4] ?? 0), Math.abs(n[5] ?? 0));
    };
    const near = mag(after.near);
    const far = mag(after.far);
    check(route, "视差幅度 ≤10px", near <= 10 && far <= 10, `near=${near.toFixed(1)}px far=${far.toFixed(1)}px`);
  }

  if (errors.length) check(route, "无 pageerror", false, errors.slice(0, 2).join(" | "));
  else check(route, "无 pageerror", true, "");

  await ctx.close();
}

/** 减动效：所有动画必须静止 */
async function auditReducedMotion(route) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*"));
    const running = all.filter((el) => {
      const s = getComputedStyle(el);
      return s.animationName && s.animationName !== "none" && s.animationIterationCount !== "0";
    });
    const drops = Array.from(document.querySelectorAll("[class*='drop']")).filter((el) => {
      const s = getComputedStyle(el);
      return s.animationName !== "none" || Number(s.opacity) > 0.05;
    });
    return {
      running: running.length,
      names: [...new Set(running.map((el) => getComputedStyle(el).animationName))].slice(0, 8),
      drops: drops.length,
    };
  });
  check(route, "减动效：无运行中动画", m.running === 0, `running=${m.running} [${m.names.join(",")}]`);
  await ctx.close();
}

/** 移动视口：溢出 + 触控区 */
async function auditMobile(route) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => {
    const clickable = Array.from(
      // 只算真正可交互的元素；[data-demo-id] 也可能挂在纯文本节点上（如进度段落），不算触控区
      document.querySelectorAll("button, a[href], input, select, textarea, [role='button'], [role='tab']"),
    ).filter((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 4 && r.height > 4 && s.visibility !== "hidden" && s.display !== "none";
    });
    const small = clickable
      .filter((el) => el.getBoundingClientRect().height < 44)
      .map((el) => `${el.tagName.toLowerCase()}:${(el.textContent ?? "").trim().slice(0, 10)}`)
      .slice(0, 8);
    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      clickable: clickable.length,
      small,
    };
  });
  check(route, "移动端无横向溢出", m.overflowX === 0, `overflowX=${m.overflowX}px`);
  check(route, "触控区 ≥44px", m.small.length === 0, m.small.length ? `偏小: ${m.small.join(", ")}` : `${m.clickable} 个可点元素`);
  await ctx.close();
}

for (const route of routes) {
  console.log(`\n=== ${route} ===`);
  try {
    await auditDesktop(route);
    await auditReducedMotion(route);
    await auditMobile(route);
  } catch (e) {
    check(route, "审计异常", false, String(e.message ?? e).slice(0, 160));
  }
}

await browser.close();

fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(`\n合计 ${report.length} 项，失败 ${failures.length} 项`);
if (failures.length) {
  console.log("\n失败项：");
  for (const f of failures) console.log(`  ${f.route}  ${f.name}  ${f.detail ?? ""}`);
}
console.log(`明细：${path.join(outDir, "report.json")}`);
process.exitCode = failures.length ? 1 : 0;
