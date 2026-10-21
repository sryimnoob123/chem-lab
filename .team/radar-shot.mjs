import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = "http://127.0.0.1:3004";
const OUT = "C:/Users/14681/AppData/Local/Temp/chemlab-shots/teacher-chart";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !/WebSocket|_next\/hmr/.test(m.text())) errors.push(m.text().slice(0, 160));
});

const unlock = await page.request.post(`${BASE}/api/teacher/unlock`, { data: { passcode: "2026" } });
console.log("unlock:", unlock.status());

for (const target of [
  { route: "/teacher", file: "teacher-1440.png" },
  { route: "/teacher/student/20250101", file: "student-1440.png" },
  { route: "/teacher/student/20250102", file: "student-done-1440.png" },
]) {
  const resp = await page.goto(BASE + target.route, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const svg = document.querySelector("figure svg");
    const fig = document.querySelector("figure");
    return {
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      svgWidth: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
      svgHeight: svg ? Math.round(svg.getBoundingClientRect().height) : 0,
      polygonCount: document.querySelectorAll("polygon").length,
      circleCount: document.querySelectorAll("circle").length,
      labels: [...document.querySelectorAll("figure text")].map((t) => t.textContent.trim()).slice(0, 20),
      figureText: fig ? fig.textContent.replace(/\s+/g, " ").slice(0, 240) : "",
    };
  });
  console.log(target.route, resp?.status(), JSON.stringify(info));
  await page.screenshot({ path: `${OUT}/${target.file}`, fullPage: false });
  if (target.route === "/teacher") {
    await page.screenshot({ path: `${OUT}/teacher-full-1440.png`, fullPage: true });
  }
}

if (errors.length) console.log("errors:", errors);
await browser.close();
