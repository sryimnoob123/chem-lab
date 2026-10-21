/**
 * 读报告页完整文本，定位分数构成（预习/操作/后测各占多少）。
 * 用法：node scripts/audit-report-breakdown.mjs [exp01]
 */
import { chromium } from "@playwright/test";
import { loginStudent } from "./lib/click-op.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const expId = process.argv[2] ?? "exp01";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
await loginStudent(page, { base: BASE });

// 从教师端拿最近一次 run 的 id
await page.goto(`${BASE}/exp/${expId}/report`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

const text = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g, "\n"));
const lines = text.split("\n").filter((l) => l.trim());
console.log("URL:", page.url());
console.log("--- 报告页文本（前 80 行）---");
console.log(lines.slice(0, 80).join("\n"));
await page.screenshot({ path: "public/shots-prod/redteam/r8-report-breakdown.png", fullPage: false });
await browser.close();
