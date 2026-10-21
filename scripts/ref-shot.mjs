/**
 * 一次性：给参考项目的原型页拍桌面截图，用来学信息层级（不是抄皮肤）。
 * 用法：node scripts/ref-shot.mjs [输出目录]
 */
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { chromium } from "@playwright/test";

const BASE = path.join(os.tmpdir(), "ref-project", "projects", ".cozeproj", "prototype", "web");
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(os.tmpdir(), "ref-shots");

const PAGES = [
  "home",
  "experiments",
  "experiment",
  "report",
  "teacher-dashboard",
  "teacher-roster",
  "teacher-student",
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

for (const name of PAGES) {
  const file = path.join(BASE, `${name}.html`);
  if (!fs.existsSync(file)) {
    console.log("skip (no file)", name);
    continue;
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(`file:///${file.replace(/\\/g, "/")}`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(400);
    const dest = path.join(OUT, `${name}-1440.png`);
    await page.screenshot({ path: dest });
    console.log("ok", name, "->", dest);
  } catch (err) {
    console.log("fail", name, String(err instanceof Error ? err.message : err).slice(0, 100));
  }
  await page.close();
}

await browser.close();
