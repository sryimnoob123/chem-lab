/**
 * 抓取河南大学官网首页的图片，落到 public/brand/campus/
 * 用法：node scripts/grab-campus-images.mjs [url]
 */
import fs from "node:fs";
import path from "node:path";

const site = process.argv[2] ?? "https://www.henu.edu.cn/";
const outDir = path.join("public", "brand", "campus");
fs.mkdirSync(outDir, { recursive: true });

const res = await fetch(site, {
  headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36" },
  signal: AbortSignal.timeout(25000),
});
const html = await res.text();
const base = new URL(site);

const urls = new Set();
for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/g)) urls.add(m[1]);
for (const m of html.matchAll(/url\(["']?([^"')]+)["']?\)/g)) urls.add(m[1]);
for (const m of html.matchAll(/data-src=["']([^"']+)["']/g)) urls.add(m[1]);

const abs = [...urls]
  .map((u) => {
    try {
      return new URL(u, base).toString();
    } catch {
      return null;
    }
  })
  .filter((u) => u && /\.(jpe?g|png|webp)(\?|$)/i.test(u));

console.log("候选图片", abs.length, "张");

let saved = 0;
const manifest = [];
for (const u of abs) {
  if (saved >= 8) break;
  try {
    const r = await fetch(u, {
      headers: { referer: site, "user-agent": "Mozilla/5.0 Chrome/120" },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 40_000) continue; // 太小的多半是图标
    const ext = (/\.(jpe?g|png|webp)/i.exec(u) || [".jpg"])[0].toLowerCase();
    const name = `campus-${String(saved + 1).padStart(2, "0")}${ext}`;
    fs.writeFileSync(path.join(outDir, name), buf);
    manifest.push({ name, url: u, bytes: buf.length });
    saved++;
    console.log(`[OK] ${name} · ${Math.round(buf.length / 1024)} KB · ${u.slice(0, 90)}`);
  } catch {
    /* 跳过失败的 */
  }
}

fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log(`\n共保存 ${saved} 张到 ${outDir}`);
