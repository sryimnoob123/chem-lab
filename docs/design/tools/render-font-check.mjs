// 自检字体是否真的从 public/fonts/ 加载，并截图字体样张。
// 运行：node docs/design/tools/render-font-check.mjs
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\/+/, "");
    const p = resolve(root, rel);
    if (!p.startsWith(root)) throw new Error("outside root");
    res.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream" });
    res.end(await readFile(p));
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((ok) => server.listen(4317, "127.0.0.1", ok));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 980, height: 760 }, deviceScaleFactor: 2 });
await page.goto("http://127.0.0.1:4317/docs/design/tools/font-check.html");
await page.evaluate(() => document.fonts.ready);

const checks = await page.evaluate(() => {
  const faces = [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`);
  const check = (spec, text) => document.fonts.check(spec, text);
  return {
    noto400: check('400 16px "Noto Sans SC"', "化"),
    noto500: check('500 16px "Noto Sans SC"', "化"),
    noto700: check('700 16px "Noto Sans SC"', "化"),
    wenkai: check('400 16px "LXGW WenKai"', "滴"),
    mono: check('400 16px "IBM Plex Mono"', "0"),
    loaded: faces.filter((f) => f.endsWith("loaded")).length,
    total: faces.length,
  };
});
await page.locator("#checks").evaluate((el, c) => {
  el.innerHTML = Object.entries(c)
    .map(([k, v]) => `${k} = ${v}`)
    .join(" · ");
}, checks);
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(root, "docs/design/fonts-preview.png"), fullPage: true });
console.log(JSON.stringify(checks, null, 2));
await browser.close();
server.close();
