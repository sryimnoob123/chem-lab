#!/usr/bin/env node
/**
 * 排版审计截图 + 指标采集
 *
 * 用途：一个命令跑完六页 × 两视口，落截图到 docs/typography-audit/，
 * 同时输出每页的「字号档位分布 / 横向溢出 / 长段落条数」，
 * 让「改完了」有可核对的数据，而不是肉眼感觉。
 *
 * 用法：node scripts/type-audit.mjs [--tag before|after]
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const tag = process.argv.includes("--tag")
  ? process.argv[process.argv.indexOf("--tag") + 1]
  : "before";
const base = process.env.BASE_URL ?? "http://localhost:3000";
const outDir = path.join("docs", "typography-audit");
fs.mkdirSync(outDir, { recursive: true });

const PAGES = [
  { slug: "01-home", route: "/", name: "首页" },
  { slug: "02-login", route: "/login", name: "登录" },
  { slug: "03-exp01", route: "/exp/exp01?force=1", name: "exp01 实验台" },
  { slug: "04-plan", route: "/plan", name: "拼接实验" },
  { slug: "05-report", route: "/exp/exp01/report", name: "报告页" },
  { slug: "06-teacher", route: "/teacher", name: "教师端" },
];

const VIEWPORTS = [
  { w: 1366, h: 768, label: "1366x768" },
  { w: 1920, h: 1080, label: "1920x1080" },
];

const browser = await chromium.launch();
const report = {};

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  });
  for (const p of PAGES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push("console:" + m.text().slice(0, 160));
    });
    await page.goto(base + p.route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1800);
    await page
      .evaluate(() =>
        Promise.race([
          Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
          new Promise((r) => setTimeout(r, 1200)),
        ]).catch(() => {}),
      )
      .catch(() => {});
    await page.waitForTimeout(200);

    const metrics = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const hist = {};
      const longParas = [];
      const overflows = [];
      const els = Array.from(document.querySelectorAll("body *"));
      for (const el of els) {
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) continue;
        const text = (el.textContent ?? "").trim();
        const tag = el.tagName.toLowerCase();
        const isTextLeaf =
          ["p", "li", "h1", "h2", "h3", "h4", "span", "strong", "em", "small", "td", "dd", "dt", "figcaption", "blockquote", "label", "button", "a"].includes(tag);
        if (isTextLeaf && text.length > 0) {
          const fs = Math.round(parseFloat(s.fontSize) * 10) / 10;
          const key = `${fs}px/${s.fontWeight}`;
          hist[key] = (hist[key] ?? 0) + 1;
        }
        // 长段落：真实文本块的渲染高度 > 2 行，且长度可观
        if (tag === "p" || tag === "li" || tag === "figcaption" || tag === "dd") {
          const r = el.getBoundingClientRect();
          const lh = parseFloat(s.lineHeight) || fs(s);
          function fs(e) {
            return parseFloat(getComputedStyle(e).fontSize) * 1.6;
          }
          const lines = lh ? Math.round(r.height / lh) : 0;
          if (text.length > 40 && lines >= 3) {
            longParas.push({ tag, lines, chars: text.length, text: text.slice(0, 70) });
          }
        }
        // 横向溢出
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > vw + 1.5 || r.left < -1.5)) {
          if (overflows.length < 8) {
            overflows.push({
              tag,
              cls: (el.className ?? "").toString().slice(0, 50),
              right: Math.round(r.right),
              left: Math.round(r.left),
              text: text.slice(0, 40),
            });
          }
        }
      }
      return {
        docScrollWidth: document.documentElement.scrollWidth,
        vw,
        fontHist: hist,
        longParas,
        overflows,
      };
    });

    await page.screenshot({
      path: path.join(outDir, `${tag}-${p.slug}-${vp.label}.jpg`),
      type: "jpeg",
      quality: 82,
      fullPage: false,
    });
    const key = `${p.slug}@${vp.label}`;
    report[key] = { name: p.name, route: p.route, errors, ...metrics };
    await page.close();
  }
  await ctx.close();
}
await browser.close();

fs.writeFileSync(path.join(outDir, `metrics-${tag}.json`), JSON.stringify(report, null, 2));

// 终端摘要：每页横向溢出 + 字号档位 + 长段落
for (const [key, r] of Object.entries(report)) {
  const sizes = Object.keys(r.fontHist).sort((a, b) => parseFloat(a) - parseFloat(b));
  console.log(
    `\n== ${key} (${r.name}) scrollW=${r.docScrollWidth} vw=${r.vw} 溢出=${r.overflows.length} 长段落=${r.longParas.length} err=${r.errors.length}`,
  );
  console.log(`   字号档位(${sizes.length}): ${sizes.join(" ")}`);
  for (const o of r.overflows) console.log(`   溢出 ${o.tag}.${o.cls} [${o.left},${o.right}] ${o.text}`);
  for (const l of r.longParas.slice(0, 6)) console.log(`   长段落 ${l.lines}行 ${l.chars}字: ${l.text}`);
  for (const e of r.errors.slice(0, 4)) console.log(`   ERR ${e}`);
}
