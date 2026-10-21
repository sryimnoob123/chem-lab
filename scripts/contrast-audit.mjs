/**
 * 对比度审计：找出「文字颜色 vs 实际背景」对比度不足的元素。
 *
 * 为什么需要：亮场改造把 --bench-ink 从 #0E1620 换成 #F6F7F5，
 * 但组件里还有大量硬编码的 #fff / rgba(246,247,245,…) 文字色，
 * 换底后会出现"白字白底"。肉眼扫全站不可靠，用 WCAG 相对亮度算。
 *
 * 用法：$env:BASE_URL="http://localhost:3002"; node scripts/contrast-audit.mjs [route]
 * 阈值：正文 4.5:1、大字(≥18.66px 或 bold≥14px) 3:1；本脚本按 3:1 报"严重"，4.5:1 报"偏低"。
 */
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const route = process.argv[2] ?? "/exp/exp01?force=1";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(base + route, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);

const findings = await page.evaluate(() => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const n = m[1].split(",").map((v) => Number(v.trim()));
    return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (fg, bg) => {
    const a = lum(fg) + 0.05;
    const b = lum(bg) + 0.05;
    return a > b ? a / b : b / a;
  };
  const mix = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });

  /** 往上找第一个不透明背景 */
  const bgOf = (el) => {
    let node = el;
    let acc = null;
    while (node && node !== document.documentElement) {
      const s = getComputedStyle(node);
      const c = parse(s.backgroundColor);
      if (c && c.a > 0.001) {
        acc = acc ? mix(acc, c) : c;
        if (acc.a >= 0.999 || c.a >= 0.999) return acc;
      }
      node = node.parentElement;
    }
    return acc ?? { r: 255, g: 255, b: 255, a: 1 };
  };

  const out = [];
  const seen = new Set();
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const text = (el.childNodes.length === 1 && el.firstChild?.nodeType === 3 ? el.textContent : "") ?? "";
    const t = text.trim();
    if (!t || t.length < 2) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) < 0.15) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) continue;

    const fgRaw = parse(s.color);
    if (!fgRaw) continue;
    const bg = bgOf(el);
    const fg = fgRaw.a < 1 ? mix(fgRaw, bg) : fgRaw;
    const cr = ratio(fg, bg);
    const size = Number.parseFloat(s.fontSize);
    const bold = Number(s.fontWeight) >= 600;
    const large = size >= 18.66 || (bold && size >= 14);
    const need = large ? 3 : 4.5;
    if (cr >= need) continue;

    const cls = typeof el.className === "string" ? el.className.split(" ").slice(0, 2).join(".") : "";
    const key = `${el.tagName}.${cls}|${t.slice(0, 12)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      tag: el.tagName.toLowerCase(),
      cls,
      text: t.slice(0, 24),
      color: s.color,
      bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
      ratio: Number(cr.toFixed(2)),
      need,
      fontSize: size,
      severe: cr < 3,
    });
  }
  return out;
});

await browser.close();

const severe = findings.filter((f) => f.severe);
const low = findings.filter((f) => !f.severe);

console.log(`\n=== 对比度审计 ${route} ===`);
console.log(`严重（<3:1）：${severe.length} 项　偏低（<4.5:1）：${low.length} 项\n`);
for (const f of severe.slice(0, 25)) {
  console.log(`✗严重 ${f.ratio.toFixed(2)}:1  <${f.tag}${f.cls ? "." + f.cls : ""}>  "${f.text}"`);
  console.log(`        color=${f.color}  bg=${f.bg}  size=${f.fontSize}`);
}
for (const f of low.slice(0, 15)) {
  console.log(`△偏低 ${f.ratio.toFixed(2)}:1  <${f.tag}${f.cls ? "." + f.cls : ""}>  "${f.text}"`);
  console.log(`        color=${f.color}  bg=${f.bg}  size=${f.fontSize}`);
}

process.exitCode = severe.length ? 1 : 0;
