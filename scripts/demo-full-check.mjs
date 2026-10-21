/**
 * 演示模式全流程验收：从浮层开演，自己走完 6 步 → 交卷 → 报告页。
 * 用法：node scripts/demo-full-check.mjs [超时秒=180]
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import os from "node:os";

const limit = Number(process.argv[2] ?? 180);
const shotDir = path.join(os.tmpdir(), "chemlab-shots", "demo-full");
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));

await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.locator("[data-demo-id='demo-mode-open']").click();
await page.waitForTimeout(800);

const started = Date.now();
let reachedReport = false;
let sawExp = false;
const seen = new Set();

while ((Date.now() - started) / 1000 < limit) {
  await page.waitForTimeout(1500);
  const src = await page.locator(".demo-frame__iframe").getAttribute("src").catch(() => "");
  if (src) seen.add(src);
  if (src && src.includes("/exp/exp09") && !src.includes("report")) sawExp = true;
  // 交卷后 iframe 内部会跳到报告页（src 属性不变），所以直接读 iframe 文本
  const frameText = await page
    .frameLocator(".demo-frame__iframe")
    .locator("body")
    .innerText()
    .catch(() => "");
  if (text0 === "" && /总分|实验报告/.test(frameText)) {
    reachedReport = true;
    text0 = frameText;
    break;
  }
  if (src && src.includes("/report")) {
    reachedReport = true;
    break;
  }
  const cap = await page.locator(".demo-caption__text").innerText().catch(() => "");
  if (cap) process.stdout.write(`\r[${Math.round((Date.now() - started) / 1000)}s] ${cap.slice(0, 56)}   `);
}

console.log("\n");
let text = "";
if (reachedReport) {
  const frame = page.frameLocator(".demo-frame__iframe");
  await page.waitForTimeout(2500);
  text = (await frame.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 240);
}

await page.screenshot({ path: path.join(shotDir, "end.png") });
await b.close();

const score = text.match(/(\d{2,3})\s*\/\s*100/);
console.log(`经过页面: ${[...seen].join(" → ")}`);
console.log(`到达实验页: ${sawExp ? "是" : "否"}`);
console.log(`到达报告页: ${reachedReport ? "是" : "否"}`);
console.log(`报告总分: ${score ? score[1] : "未读到"}`);
console.log(`报告文本: ${text.slice(0, 150)}`);
if (errors.length) console.log("pageerror:", JSON.stringify([...new Set(errors)].slice(0, 3)));
console.log("截图:", path.join(shotDir, "end.png"));
process.exitCode = reachedReport && score ? 0 : 1;
