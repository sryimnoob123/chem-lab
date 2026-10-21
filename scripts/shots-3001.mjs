import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.PROD_BASE ?? "http://localhost:3001";
const dir = path.join("evidence", "prod-start");
fs.mkdirSync(dir, { recursive: true });

const exeCandidates = [
  process.env.CHROME_PATH,
  path.join(process.env.LOCALAPPDATA ?? "", "hermes", "tools", "chromium-1208", "chrome-win64", "chrome.exe"),
].filter(Boolean);
const exe = exeCandidates.find((p) => fs.existsSync(p));

const b = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e.message).slice(0, 120)));

await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(dir, "3001-home.png") });

await page.goto(base + "/login", { waitUntil: "networkidle" });
await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
await page.locator("[data-demo-id='demo-login-submit']").click();
await page.waitForURL(/\/experiments/, { timeout: 15000 });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(dir, "3001-catalog.png") });

const title = await page.title();
const finalUrl = page.url();
await b.close();
console.log("标题:", title);
console.log("URL:", finalUrl);
console.log("pageerror:", errs.length ? errs.slice(0, 3).join(" | ") : 0);
console.log("截图:", dir);
