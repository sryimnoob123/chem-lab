import { chromium } from "@playwright/test";
import path from "node:path";
import os from "node:os";

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.locator("[data-demo-id='demo-mode-open']").click();
await page.waitForTimeout(1000);

const frame = page.frameLocator(".demo-frame__iframe");
let text = "";
for (let i = 0; i < 70; i++) {
  await page.waitForTimeout(1500);
  const t = await frame.locator("body").innerText().catch(() => "");
  if (/总分/.test(t)) {
    text = t.replace(/\s+/g, " ");
    break;
  }
}
const score = text.match(/(\d{2,3})\s*\/\s*100/);
await page.screenshot({ path: path.join(os.tmpdir(), "chemlab-shots", "demo-report-in-run.png") });
await b.close();
console.log("报告出现:", Boolean(text), "| 总分:", score ? score[1] : "未读到");
console.log("文本:", text.slice(0, 160));
