import { chromium } from "@playwright/test";

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
await page.locator("[data-demo-id='demo-login-submit']").click();
await page.waitForTimeout(1500);
await page.goto("http://localhost:3000/exp/exp09", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);

const el = page.locator("[data-demo-id='demo-scene-reagent-naoh']").first();
const before = await el.evaluate((n) => ({ cls: n.className, attrs: [...n.attributes].map((a) => a.name + "=" + a.value).join(" ") }));
await el.click();
await page.waitForTimeout(500);
const after = await el.evaluate((n) => ({ cls: n.className, attrs: [...n.attributes].map((a) => a.name + "=" + a.value).join(" ") }));
const targets = await page.evaluate(
  () => document.querySelectorAll("[data-drop-target='true']").length,
);
console.log("点击前:", JSON.stringify(before).slice(0, 200));
console.log("点击后:", JSON.stringify(after).slice(0, 260));
console.log("drop-target 数量:", targets);
await b.close();
