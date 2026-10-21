import { chromium } from "@playwright/test";

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on("pageerror", (e) => console.log("ERR", String(e.message).slice(0, 100)));
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.locator("[data-demo-id='demo-mode-open']").click();

for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(1500);
  const frames = page.frames().map((f) => f.url());
  const cap = await page.locator(".demo-caption__text").innerText().catch(() => "");
  if (i % 4 === 3) console.log(`[${(i + 1) * 1.5}s] frames=${JSON.stringify(frames)} cap=${cap.slice(0, 40)}`);
  if (frames.some((u) => u.includes("/report"))) {
    console.log("→ 报告页出现在 frame 里");
    const f = page.frames().find((u) => u.url().includes("/report"));
    const t = await f.locator("body").innerText().catch(() => "");
    console.log("报告文本:", t.replace(/\s+/g, " ").slice(0, 200));
    break;
  }
}
await b.close();
