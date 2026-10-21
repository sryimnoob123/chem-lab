import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on("pageerror", (e) => console.log("PAGEERROR:", String(e.message).slice(0, 300)));
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(m.type().toUpperCase() + ":", m.text().slice(0, 300)); });
await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const n = await p.evaluate(() => ({
  revealOut: document.querySelectorAll('[data-reveal="out"]').length,
  revealIn: document.querySelectorAll('[data-reveal="in"]').length,
  hydrated: Boolean(document.querySelector("[data-deck-ready]")) || document.documentElement.hasAttribute("data-hydrated"),
}));
console.log("STATE:", JSON.stringify(n));
await b.close();
