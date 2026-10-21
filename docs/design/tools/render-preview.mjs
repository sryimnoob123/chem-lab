// 生成 docs/design/instruments-preview.png 与 docs/design/brand-preview.png
// 运行：node docs/design/tools/render-preview.mjs
import { chromium } from "@playwright/test";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");

const pages = [
  { html: "instruments-preview.html", png: "instruments-preview.png", width: 1180, height: 560 },
  { html: "brand-preview.html", png: "brand-preview.png", width: 1180, height: 460 },
];

const browser = await chromium.launch();
for (const p of pages) {
  const page = await browser.newPage({ viewport: { width: p.width, height: p.height }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(resolve(here, p.html)).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const out = resolve(root, "docs/design", p.png);
  await page.screenshot({ path: out, fullPage: true });
  console.log("screenshot:", out);
  await page.close();
}
await browser.close();
