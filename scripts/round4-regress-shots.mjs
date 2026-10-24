/**
 * 第四轮回归实拍：exp03 / exp09 / 报告页 / 教师端，改前改后各一张。
 * 用法：node scripts/round4-regress-shots.mjs --tag before|after
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const argv = process.argv.slice(2);
const argOf = (n, d) => (argv.indexOf(n) >= 0 && argv[argv.indexOf(n) + 1]) || d;
const BASE = (argOf("--base", process.env.BASE ?? "http://127.0.0.1:3000")).replace(/\/$/, "");
const TAG = argOf("--tag", "after");
const OUT = path.resolve(argOf("--out", `evidence/2026-10-24-round4-regress/${TAG}`));
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STUDENT = { no: "20250101", name: "周若曦" };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });

// 用应用自己的登录接口种会话（和 E1 链路同一身份，报告/教师端才认得出是同一个人）
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }).catch(() => null);
await page.request.post(`${BASE}/api/session`, {
  headers: { "content-type": "application/json" },
  data: STUDENT,
});

const shots = [];
async function shot(name, url, wait = 3000) {
  const res = await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 120000 }).catch(() => null);
  await sleep(wait);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const info = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    chars: document.body.innerText.replace(/\s+/g, "").length,
    title: document.title,
  }));
  shots.push({ name, url, status: res?.status() ?? null, ...info });
  console.log(`${name}\tHTTP ${res?.status()}\tchars ${info.chars}\tscroll ${info.scrollW}/${info.clientW}`);
}

await shot("exp03", "/exp/exp03?force=1", 3500);
await shot("exp09", "/exp/exp09?force=1", 3500);
await shot("report", "/exp/exp01/report", 3000);
await shot("teacher", "/teacher", 3500);

fs.writeFileSync(path.join(OUT, "info.json"), JSON.stringify({ tag: TAG, base: BASE, shots, errors }, null, 2));
console.log("errors:", errors.slice(0, 6));
await browser.close();
