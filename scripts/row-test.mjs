import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto("http://localhost:3000/experiments", { waitUntil: "networkidle" });
const info = await p.evaluate(() => {
  const row = document.querySelector('.cat-row[data-state="open"] .cat-row__link');
  if (!row) return { found: false };
  return { found: true, tag: row.tagName, href: row.getAttribute("href"), text: row.textContent?.slice(0, 40) };
});
console.log("OPEN ROW:", JSON.stringify(info));
const all = await p.evaluate(() => Array.from(document.querySelectorAll(".cat-row")).map(r => ({ s: r.getAttribute("data-state"), h: r.querySelector("a")?.getAttribute("href") })));
console.log("ROWS:", JSON.stringify(all));
const nav = await p.goto("http://localhost:3000/exp/exp09", { waitUntil: "networkidle" });
console.log("direct /exp/exp09 ->", nav?.status());
console.log("title:", await p.title());
const bodyText = (await p.locator("body").innerText()).slice(0, 200);
console.log("BODY:", bodyText.replace(/\n/g, " | "));
await b.close();
