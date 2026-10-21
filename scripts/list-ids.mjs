import { chromium } from "@playwright/test";

const route = process.argv[2] ?? "/exp/exp09";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { height: 1000, width: 1440 } })).newPage();
await p.goto("http://localhost:3000" + route, { waitUntil: "networkidle" });
await p.waitForTimeout(700);

const ids = await p.evaluate(() =>
  Array.from(document.querySelectorAll("[data-demo-id]")).map((n) => n.getAttribute("data-demo-id")),
);
const buttons = await p.evaluate(() =>
  Array.from(document.querySelectorAll("button"))
    .map((n) => (n.innerText || "").replace(/\s+/g, " ").trim().slice(0, 26))
    .filter(Boolean),
);
const links = await p.evaluate(() => Array.from(document.querySelectorAll("a[href]")).map((n) => n.getAttribute("href")));

console.log("DATA-DEMO-ID (" + ids.length + "):");
for (const id of ids) console.log("  " + id);
console.log("\nBUTTONS (" + buttons.length + "):");
for (const t of buttons) console.log("  " + t);
console.log("\nLINKS:", JSON.stringify([...new Set(links)].slice(0, 20)));
await b.close();
