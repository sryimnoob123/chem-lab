import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const dir = path.join("evidence", "screens");
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 })).newPage();
const resp = await page.goto("http://localhost:3000/shots/index.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const cards = await page.locator(".card").count();
const imgsOk = await page.evaluate(() =>
  Array.from(document.images).filter((i) => i.complete && i.naturalWidth > 0).length,
);
const total = await page.evaluate(() => document.images.length);
await page.screenshot({ path: path.join(dir, "index-wall.png"), fullPage: false });
await b.close();
console.log("index 状态:", resp.status(), "| 卡片:", cards, "| 图片加载:", imgsOk + "/" + total);
