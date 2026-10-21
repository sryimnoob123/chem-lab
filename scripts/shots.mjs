#!/usr/bin/env node
/**
 * 截图素材归档（明天录屏直接用）
 *
 * 固定视口 1440×900、deviceScaleFactor=2，按流程逐页截图到 public/shots/，
 * 每张：等网络空闲 + 等字体与动画结束 + 校验非白屏；全程 pageerror=0。
 * 末尾生成 public/shots/index.html 缩略图墙（按序号排，点开看大图）。
 *
 * 用法：node scripts/shots.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = "http://localhost:3000";
const outDir = path.join("public", "shots");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const manifest = [];
const errors = [];
let index = 1;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce", // 关掉入场动画，避免截到半截
});
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 140)));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/Failed to load resource/.test(t) && /(400|401|403|404)/.test(t)) return;
  errors.push("console:" + t.slice(0, 120));
});

/** 等网络空闲 + 字体就绪 + 动画收尾 */
const settle = async () => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts?.ready.catch(() => {})).catch(() => {});
  await page
    .evaluate(() =>
      Promise.race([
        Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
        new Promise((r) => setTimeout(r, 1200)),
      ]),
    )
    .catch(() => {});
  await page.waitForTimeout(350);
};

/** 截一张：校验非白屏后落盘 */
const shot = async (label, slug) => {
  await settle();
  const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, "");
  if (text.length < 30) {
    errors.push(`${slug} 疑似白屏（文本 ${text.length} 字）`);
  }
  const name = `${String(index++).padStart(2, "0")}-${slug}.png`;
  const full = path.join(outDir, name);
  await page.screenshot({ path: full });
  const kb = Math.round(fs.statSync(full).size / 1024);
  manifest.push({ no: name.slice(0, 2), name, label, kb, url: new URL(page.url()).pathname });
  console.log(`  ✓ ${name}  ${label}  ${kb}KB`);
};

const go = async (route) => {
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  await settle();
};

const login = async () => {
  await go("/login");
  await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
  await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
  await page.locator("[data-demo-id='demo-login-submit']").click();
  await page.waitForTimeout(1200);
};

console.log("开始截图（1440×900 @2x）…");

// ---- 1 门户 / 2 登录 ----
await go("/");
await shot("门户首页", "portal");
await go("/login");
await shot("学生登录", "login");

// ---- 3 实验选择 ----
await login();
await go("/experiments");
await shot("实验选择", "catalog");

// ---- 4 实验页初始 ----
await go("/exp/exp09");
await shot("实验页 · 初始", "exp-initial");

// ---- 5 拖试剂 ----
try {
  await page
    .locator("[data-demo-id='demo-scene-reagent-naoh']")
    .first()
    .dragTo(page.locator("[data-demo-id='demo-scene-drop-flask']").first(), { timeout: 8000 });
  await page.waitForTimeout(500);
  await shot("拖试剂 · 投放结果", "drag-reagent");
} catch (e) {
  errors.push("拖试剂截图失败：" + String(e).slice(0, 80));
}

// ---- 6 点操作中（选中态） ----
await go("/exp/exp09");
try {
  await page.locator("[data-demo-id='demo-scene-reagent-naoh']").first().click();
  await page.waitForTimeout(400);
  await shot("点选 · 已选中待投放", "click-selected");
} catch (e) {
  errors.push("点选截图失败：" + String(e).slice(0, 80));
}

// ---- 7 成功分支 ----
await go("/exp/exp09");
try {
  await page.locator("[data-demo-id='demo-op-step1-weigh']").first().click();
  await page.waitForTimeout(700);
  await shot("成功分支 · 为什么对", "success");
} catch (e) {
  errors.push("成功分支截图失败：" + String(e).slice(0, 80));
}

// ---- 8 失败分支 ----
await go("/exp/exp09");
try {
  await page.locator("[data-demo-id='demo-op-step1-bare-hands']").first().click();
  await page.waitForTimeout(800);
  await shot("失败分支 · 错在哪/为什么", "failure");
} catch (e) {
  errors.push("失败分支截图失败：" + String(e).slice(0, 80));
}

// ---- 9 重做 ----
try {
  const retry = page.locator("[data-demo-id^='demo-retry-']").first();
  if (await retry.count()) {
    await retry.click();
    await page.waitForTimeout(700);
    await shot("重做本步 · 回到开头", "retry");
  } else {
    errors.push("重做按钮未找到");
  }
} catch (e) {
  errors.push("重做截图失败：" + String(e).slice(0, 80));
}

// ---- 10+ 演示模式全程 ----
await go("/");
try {
  await page.locator("[data-demo-id='demo-mode-open']").first().click();
  await page.waitForTimeout(900);
  await shot("演示模式 · 点开", "demo-open");

  const wanted = [
    ["/login", "演示 · 自动登录", "demo-login"],
    ["/experiments", "演示 · 实验选择", "demo-catalog"],
    ["/exp/exp09/report", "演示 · 结果页", "demo-report"],
    ["show=fx", "演示 · 事故大秀", "demo-fx"],
    ["/teacher", "演示 · 教师端", "demo-teacher"],
    ["/exp/exp09", "演示 · 实验台", "demo-exp"],
  ];
  const seen = new Set();
  let lastSrc = "";
  const t0 = Date.now();
  while (wanted.some(([, , slug]) => !seen.has(slug)) && (Date.now() - t0) / 1000 < 260) {
    await page.waitForTimeout(600);
    const src = (await page.locator(".demo-frame__iframe").getAttribute("src").catch(() => "")) ?? "";
    if (!src || src === lastSrc) continue;
    lastSrc = src;
    for (const [key, label, slug] of wanted) {
      if (seen.has(slug) || !src.includes(key)) continue;
      // 让这一场演到有内容再截（等字幕更新过一轮）
      await page.waitForTimeout(2600);
      await shot(label, slug);
      seen.add(slug);
    }
  }
  await page.screenshot({ path: path.join(outDir, "99-demo-end.png") });
} catch (e) {
  errors.push("演示截图失败：" + String(e).slice(0, 80));
}

await browser.close();

// ---- index.html 缩略图墙 ----
const cards = manifest
  .map(
    (m) => `      <a class="card" href="./${m.name}" target="_blank" rel="noreferrer">
        <div class="thumb"><img src="./${m.name}" alt="${m.label}" loading="lazy" /></div>
        <div class="meta"><span class="no">${m.no}</span><span class="label">${m.label}</span><span class="kb">${m.kb}KB</span></div>
      </a>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>截图素材 · 一键演示流程</title>
<style>
  :root { --paper:#f6f7f5; --ink:#16202c; --river:#23307f; --line:rgba(22,32,44,.12); }
  * { box-sizing: border-box; }
  body { margin:0; padding:32px clamp(16px,4vw,56px) 64px; background:var(--paper); color:var(--ink);
         font-family: "LXGW WenKai", system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { display:flex; align-items:baseline; gap:16px; border-bottom:1px solid var(--line); padding-bottom:14px; margin-bottom:24px; }
  h1 { font-size:22px; margin:0; letter-spacing:.02em; }
  .sub { font-size:13px; color:rgba(22,32,44,.55); }
  .mono { font-family: ui-monospace, "SF Mono", Consolas, monospace; }
  .grid { display:grid; gap:18px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
  .card { display:block; text-decoration:none; color:inherit; border:1px solid var(--line); background:#fff;
          border-radius:2px; overflow:hidden; transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
  .card:hover { transform: translateY(-2px); border-color:var(--river); box-shadow: 0 8px 22px rgba(22,32,44,.12); }
  .thumb { aspect-ratio: 16/10; overflow:hidden; background:#e9ebe7; border-bottom:1px solid var(--line); }
  .thumb img { width:100%; height:100%; object-fit: cover; object-position: top left; display:block; }
  .meta { display:flex; align-items:center; gap:10px; padding:10px 12px; font-size:13px; }
  .no { font-family: ui-monospace, Consolas, monospace; color:var(--river); font-weight:700; }
  .label { flex:1; }
  .kb { color:rgba(22,32,44,.45); font-family: ui-monospace, Consolas, monospace; font-size:12px; }
  footer { margin-top:28px; font-size:12px; color:rgba(22,32,44,.5); }
</style>
</head>
<body>
  <header>
    <h1>截图素材</h1>
    <span class="sub mono">1440×900 @2x · ${manifest.length} 张 · 点击看大图</span>
  </header>
  <div class="grid">
${cards}
  </div>
  <footer>由 <span class="mono">node scripts/shots.mjs</span> 生成，重跑即可覆盖。</footer>
</body>
</html>
`;
fs.writeFileSync(path.join(outDir, "index.html"), html, "utf8");

console.log("\n===== 清单 =====");
for (const m of manifest) console.log(`${m.no}  ${m.label.padEnd(18, "　")} ${String(m.kb).padStart(4)}KB  ${m.url}`);
console.log(`\n文件数：${manifest.length} 张 PNG + index.html`);
console.log(`目录：${outDir}`);
console.log(`pageerror / console.error：${errors.length} 条`);
if (errors.length) console.log("  " + [...new Set(errors)].slice(0, 6).join("\n  "));
process.exitCode = errors.length ? 1 : 0;
