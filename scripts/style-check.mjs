import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
p.on("requestfailed", (r) => errs.push("REQFAIL " + r.url().slice(0, 120)));
await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
const info = await p.evaluate(() => ({
  sheets: Array.from(document.styleSheets).map((s) => (s.href || "inline") + " rules=" + (s.cssRules ? s.cssRules.length : "blocked")),
  heroDisplay: getComputedStyle(document.querySelector(".portal-hero") || document.body).display,
  bodyFont: getComputedStyle(document.body).fontFamily,
  bodyPad: getComputedStyle(document.body).paddingLeft,
}));
console.log(JSON.stringify(info, null, 2));
console.log("ERRORS:", JSON.stringify(errs.slice(0, 6), null, 2));
await b.close();
