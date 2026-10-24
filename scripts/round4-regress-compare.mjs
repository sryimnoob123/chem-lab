/**
 * 改前改后对比图 + 像素差统计（exp03 / exp09 / 报告页 / 教师端）。
 * 用法：node scripts/round4-regress-compare.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT = path.resolve("evidence/2026-10-24-round4-regress");
const OUT = path.join(ROOT, "compare");
fs.mkdirSync(OUT, { recursive: true });
const NAMES = [
  ["exp03", "exp03 醋酸电离度"],
  ["exp09", "exp09 酸碱滴定"],
  ["report", "报告页"],
  ["teacher", "教师端"],
];

const b64 = (tag, name) => {
  const p = path.join(ROOT, tag, `${name}.png`);
  return fs.existsSync(p) ? fs.readFileSync(p).toString("base64") : null;
};

const browser = await chromium.launch();
const report = [];

for (const [name, label] of NAMES) {
  const before = b64("before", name);
  const after = b64("after", name);
  if (!before || !after) { console.log(`skip ${name}`); continue; }
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0f1115"></body>`);
  const diff = await page.evaluate(async ({ b, a }) => {
    const load = (s) => new Promise((res) => { const img = new Image(); img.onload = () => res(img); img.src = `data:image/png;base64,${s}`; });
    const [ib, ia] = await Promise.all([load(b), load(a)]);
    const w = Math.min(ib.width, ia.width), h = Math.min(ib.height, ia.height);
    const cv = (img) => { const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0); return c.getContext("2d").getImageData(0, 0, w, h).data; };
    const db = cv(ib), da = cv(ia);
    let changed = 0, total = w * h, maxDelta = 0;
    for (let i = 0; i < db.length; i += 4) {
      const d = Math.abs(db[i] - da[i]) + Math.abs(db[i + 1] - da[i + 1]) + Math.abs(db[i + 2] - da[i + 2]);
      if (d > 24) changed++;
      if (d > maxDelta) maxDelta = d;
    }
    return { w, h, changedRatio: +(changed / total).toFixed(5), maxDelta };
  }, { b: before, a: after });

  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0f1115;font:13px system-ui;color:#e8eaed;width:1400px">
  <div style="padding:10px 14px;font-size:16px;font-weight:600">${label} · 改前 / 改后（像素差 ${(diff.changedRatio * 100).toFixed(3)}%）</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 12px 12px">
    <figure style="margin:0"><img src="data:image/png;base64,${before}" style="width:100%;display:block;border:1px solid #2a2e37"><figcaption style="color:#9aa2b1;padding:3px">改前（git stash 回退本轮改动）</figcaption></figure>
    <figure style="margin:0"><img src="data:image/png;base64,${after}" style="width:100%;display:block;border:1px solid #2a2e37"><figcaption style="color:#9aa2b1;padding:3px">改后（本轮 HEAD 工作树）</figcaption></figure>
  </div></body>`;
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForTimeout(300);
  const el = await page.locator("body").boundingBox();
  await page.setViewportSize({ width: 1400, height: Math.ceil(el.height) + 8 });
  await page.screenshot({ path: path.join(OUT, `${name}-compare.png`), fullPage: true });
  await page.close();
  report.push({ name, label, ...diff });
  console.log(`${name}\t差 ${(diff.changedRatio * 100).toFixed(3)}%\tmaxDelta ${diff.maxDelta}`);
}

fs.writeFileSync(path.join(OUT, "diff.json"), JSON.stringify(report, null, 2));
await browser.close();
