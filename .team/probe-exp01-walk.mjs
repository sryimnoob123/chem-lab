/** exp01 逐点正确按钮推进到第 4 步（溶解加水），再拖蒸馏水抓倒入动画。 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = "http://localhost:3000";
const OUT = join(tmpdir(), "chemlab-shots", "pour-tilt");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "C:/Users/14681/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe",
});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 140)));

await page.request.post(`${BASE}/api/session`, {
  headers: { "content-type": "application/json" },
  data: { studentNo: "20250101", name: "周若曦" },
});
await page.goto(`${BASE}/exp/exp01?force=1`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector('[data-demo-id="demo-guide-card"]', { timeout: 30000 });
// 新手教学是模态：不关掉它，后面所有点击都被 backdrop 吃掉（走查时踩过）
for (let i = 0; i < 6; i++) {
  const has = await page.locator('[data-demo-id="demo-onboarding"]').isVisible().catch(() => false);
  if (!has) break;
  const nextBtn = page.locator('[data-demo-id="demo-onboarding-next"]');
  if (await nextBtn.isVisible().catch(() => false)) await nextBtn.click();
  else await page.locator('[data-demo-id="demo-onboarding"] button[aria-label="关闭新手教学"]').click().catch(() => {});
  await page.waitForTimeout(250);
}
await page.waitForTimeout(500);

const state = () =>
  page.evaluate(() => ({
    ops: [...document.querySelectorAll('[data-demo-id^="demo-op-"]')].map((b) => b.getAttribute("data-demo-id")),
    next: document.querySelector("[data-guide='next']")?.getAttribute("data-demo-id") ?? null,
    step: document.querySelector("[data-demo-id='demo-mission-board']")?.textContent?.slice(0, 40) ?? "",
  }));

for (let i = 0; i < 12; i++) {
  const s = await state();
  console.log(`r${i} next=${s.next} ops=${s.ops.join(",")}`);
  if (s.next && /dissolve|dilute|water/.test(s.next)) break;
  const pick = s.next ?? s.ops.find((id) => /rinse|check|level|calib|weigh|tare|dry|clean/.test(id));
  if (!pick) { console.log("无可点动作"); break; }
  await page.locator(`[data-demo-id="${pick}"]`).click({ timeout: 5000 }).catch((e) => console.log("点击失败", e.message.slice(0, 60)));
  await page.waitForTimeout(1400);
}

const s = await state();
console.log("最终:", JSON.stringify(s));
console.log("errors:", errors);
await browser.close();
