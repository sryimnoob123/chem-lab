import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3004";
const OUT = "C:/Users/14681/AppData/Local/Temp/chemlab-shots/teacher-chart";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const vp of [
  { w: 1440, h: 900, tag: "1440" },
  { w: 390, h: 844, tag: "390" },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  await page.request.post(`${BASE}/api/teacher/unlock`, { data: { passcode: "2026" } });
  for (const target of [
    { route: "/teacher", tag: `teacher-${vp.tag}` },
    { route: "/teacher/student/20250136", tag: `student-empty-${vp.tag}` },
  ]) {
    const resp = await page.goto(BASE + target.route, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(200);
    const info = await page.evaluate(() => {
      const figures = [...document.querySelectorAll("figure")].map((f) => {
        const rect = f.getBoundingClientRect();
        const svg = f.querySelector("svg");
        const svgRect = svg?.getBoundingClientRect();
        return {
          w: Math.round(rect.width),
          svgW: svgRect ? Math.round(svgRect.width) : 0,
          svgH: svgRect ? Math.round(svgRect.height) : 0,
        };
      });
      const empty = document.querySelector('[role="status"]');
      return {
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        figures,
        emptyText: empty ? empty.textContent.replace(/\s+/g, " ").slice(0, 120) : null,
      };
    });
    console.log(vp.tag, target.route, resp?.status(), JSON.stringify(info));
    await page.screenshot({ path: `${OUT}/${target.tag}.png`, fullPage: vp.w <= 500 });
  }
  await ctx.close();
}
await browser.close();
