/**
 * 压缩官网图片：用 Playwright 渲染成 1600px 宽的 JPEG（无第三方图像库）
 * 原图移到 public/brand/campus/_orig/
 * 用法：node scripts/compress-campus.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const dir = path.join("public", "brand", "campus");
const origDir = path.join(dir, "_orig");
fs.mkdirSync(origDir, { recursive: true });

const files = fs.readdirSync(dir).filter((f) => /^campus-\d+\.(jpe?g|png|webp)$/i.test(f));
if (!files.length) {
  console.log("没有待压缩图片");
  process.exit(0);
}

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

for (const f of files) {
  const src = path.resolve(dir, f);
  const before = fs.statSync(src).size;
  const b64 = fs.readFileSync(src).toString("base64");
  const mime = f.endsWith(".png") ? "image/png" : f.endsWith(".webp") ? "image/webp" : "image/jpeg";
  await page.setContent(
    `<html><body style="margin:0;background:#0b1219">
      <img id="p" src="data:${mime};base64,${b64}" style="width:1600px;height:auto;display:block;object-fit:cover" />
     </body></html>`,
    { waitUntil: "load" },
  );
  await page.waitForTimeout(300);
  const name = f.replace(/\.(jpe?g|png|webp)$/i, ".jpg");
  const out = path.join(dir, name);
  const el = page.locator("#p");
  await el.screenshot({ path: out, type: "jpeg", quality: 76 });
  const after = fs.statSync(out).size;
  // 原图备份
  fs.renameSync(src, path.join(origDir, f));
  console.log(`[OK] ${name} · ${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB`);
}

await b.close();
const total = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".jpg"))
  .reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
console.log(`\n压缩后合计 ${Math.round(total / 1024)} KB`);
