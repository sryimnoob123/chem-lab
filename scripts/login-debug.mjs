import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3001";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 140)}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${String(e.message).slice(0, 140)}`));
page.on("requestfailed", (r) => logs.push(`[reqfail] ${r.url().slice(-50)} ${r.failure()?.errorText}`));
const res = [];
page.on("response", (r) => {
  if (r.url().includes("/api/") || r.url().endsWith("/experiments") || r.url().endsWith("/login")) {
    res.push(`${r.status()} ${r.request().method()} ${r.url().replace(base, "")}`);
  }
});

await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
await page.locator("[data-demo-id='demo-login-student-no']").fill("20250101");
await page.locator("[data-demo-id='demo-login-student-name']").fill("周若曦");
await page.locator("[data-demo-id='demo-login-submit']").click();
await page.waitForTimeout(4000);

console.log("URL:", page.url());
const cookies = await ctx.cookies();
console.log("cookies:", cookies.map((c) => `${c.name}(secure=${c.secure},httpOnly=${c.httpOnly})`).join(", ") || "(无)");
const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 160);
console.log("页面文本:", body);
console.log("网络:", res.join(" | "));
console.log("控制台:", logs.slice(0, 6).join(" | ") || "(无)");
await page.screenshot({ path: `${process.env.TEMP}\\chemlab-shots\\login-debug.png`, fullPage: false });
console.log("截图:", `${process.env.TEMP}\\chemlab-shots\\login-debug.png`);
await b.close();
