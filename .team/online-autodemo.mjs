/** 线上三条 autodemo 路径逐条验收：首页→实验→一键演示→报告。 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "https://smnh6y8fgh.coze.site";
const browser = await chromium.launch({
  executablePath: "C:/Users/14681/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe",
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = ctx.pages()[0] ?? (await ctx.newPage());

const errs = [];
const bad = [];
page.on("pageerror", (e) => errs.push(`pageerror: ${String(e.message).slice(0, 140)}`));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/favicon/i.test(t)) return;
  errs.push(`console: ${t.slice(0, 140)}`);
});
page.on("response", (r) => {
  if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(0, 110)}`);
});

const rows = [];
const snap = async (label) => {
  const info = await page.evaluate(() => ({
    len: document.body.innerText.replace(/\s+/g, " ").trim().length,
    url: location.pathname + location.search,
    h1: (document.querySelector("h1")?.textContent ?? "").trim().slice(0, 40),
  }));
  const issues = [];
  if (info.len < 40) issues.push(`空白页(${info.len})`);
  if (errs.length) issues.push(`error×${errs.length}: ${errs.slice(0, 2).join(" | ")}`);
  if (bad.length) issues.push(`4xx/5xx×${bad.length}: ${bad.slice(0, 3).join(" | ")}`);
  rows.push({ label, url: info.url, h1: info.h1, len: info.len, pass: issues.length === 0, issues });
  errs.length = 0;
  bad.length = 0;
};

await page.request.post(`${BASE}/api/session`, {
  headers: { "content-type": "application/json" },
  data: { studentNo: "20250101", name: "周若曦" },
});

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);
await snap("首页");

await page.goto(`${BASE}/experiments`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2000);
await snap("实验列表");

for (const expId of ["exp01", "exp03", "exp09"]) {
  await page.goto(`${BASE}/exp/${expId}?force=1&autodemo=1`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  await snap(`${expId} 一键演示 开场`);
  const ok = await page
    .waitForURL(/\/report/, { timeout: 190000 })
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(2500);
  await snap(`${expId} 一键演示 → 报告${ok ? "" : "（未跳报告页）"}`);
  if (!ok) rows.at(-1).pass = false, rows.at(-1).issues.push("没跳到报告页");
}

await browser.close();

let fails = 0;
for (const r of rows) {
  if (!r.pass) fails++;
  console.log(`${r.pass ? "PASS" : "FAIL"}\t${r.label}\t${r.url}\t${r.len}字\t${r.issues.join(" ; ")}`);
}
console.log(`\n合计 ${rows.length} 项，FAIL ${fails} 项`);
process.exit(fails ? 1 : 0);
