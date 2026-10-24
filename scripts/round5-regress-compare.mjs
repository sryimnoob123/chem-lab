/**
 * 第五轮回归像素对比：拿「上轮交付（第四轮终态）」的实拍当基线，和本轮重拍逐像素比。
 *
 * 用法：
 *   node scripts/round5-regress-compare.mjs \
 *     --before evidence/2026-10-24-round4-regress/after \
 *     --after  evidence/2026-10-24-final/regress \
 *     --out    evidence/2026-10-24-final/regress/compare
 *
 * 判据：阈值 24（单通道差 >24 才算变），输出变化像素占比 + 最大单通道差；并出左右并排图。
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const argv = process.argv.slice(2);
const argOf = (n, d) => (argv.indexOf(n) >= 0 && argv[argv.indexOf(n) + 1]) || d;
const BEFORE = path.resolve(argOf("--before", "evidence/2026-10-24-round4-regress/after"));
const AFTER = path.resolve(argOf("--after", "evidence/2026-10-24-final/regress"));
const OUT = path.resolve(argOf("--out", path.join(path.dirname(AFTER), "regress", "compare")));
fs.mkdirSync(OUT, { recursive: true });

const NAMES = [
  ["exp03", "exp03 醋酸电离度"],
  ["exp09", "exp09 酸碱滴定"],
  ["report", "报告页"],
  ["teacher", "教师端"],
];

const browser = await chromium.launch();
const report = [];

for (const [name, label] of NAMES) {
  const pb = path.join(BEFORE, `${name}.png`);
  const pa = path.join(AFTER, `${name}.png`);
  if (!fs.existsSync(pb) || !fs.existsSync(pa)) {
    console.log(`skip ${name}（缺图）`);
    continue;
  }
  const b64b = fs.readFileSync(pb).toString("base64");
  const b64a = fs.readFileSync(pa).toString("base64");
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0f1115"></body>`);
  const diff = await page.evaluate(async ({ b, a }) => {
    const load = (s) => new Promise((res) => { const img = new Image(); img.onload = () => res(img); img.src = `data:image/png;base64,${s}`; });
    const [ib, ia] = await Promise.all([load(b), load(a)]);
    const w = Math.min(ib.width, ia.width), h = Math.min(ib.height, ia.height);
    const cv = (img) => { const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0); return c.getContext("2d").getImageData(0, 0, w, h).data; };
    const db = cv(ib), da = cv(ia);
    let changed = 0, maxDelta = 0;
    for (let i = 0; i < db.length; i += 4) {
      const d = Math.max(Math.abs(db[i] - da[i]), Math.abs(db[i + 1] - da[i + 1]), Math.abs(db[i + 2] - da[i + 2]));
      if (d > 24) changed++;
      if (d > maxDelta) maxDelta = d;
    }
    return { w, h, changed, total: w * h, pct: +((changed / (w * h)) * 100).toFixed(4), maxDelta };
  }, { b: b64b, a: b64a });
  report.push({ name, label, ...diff });
  console.log(`${name}\t${diff.w}x${diff.h}\t差异像素 ${diff.changed} / ${diff.total}\t${diff.pct}%\t最大单通道差 ${diff.maxDelta}`);

  // 左右并排
  const sheet = await browser.newPage({ viewport: { width: diff.w * 2 + 30, height: diff.h + 46 } });
  await sheet.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0f1115;font:14px system-ui;color:#e8eaed">
    <div style="display:flex;gap:10px;padding:8px">
      <figure style="margin:0"><figcaption style="padding:2px 4px;color:#9aa2b1">上轮（${label}）</figcaption><img src="data:image/png;base64,${b64b}" style="display:block;width:${diff.w}px"></figure>
      <figure style="margin:0"><figcaption style="padding:2px 4px;color:#9aa2b1">本轮（${label}）· 差异 ${diff.pct}%</figcaption><img src="data:image/png;base64,${b64a}" style="display:block;width:${diff.w}px"></figure>
    </div></body>`);
  await sheet.screenshot({ path: path.join(OUT, `${name}-compare.png`), fullPage: true });
  await sheet.close();
  await page.close();
}

fs.writeFileSync(path.join(OUT, "diff.json"), JSON.stringify({ before: BEFORE, after: AFTER, rows: report }, null, 2));
await browser.close();
