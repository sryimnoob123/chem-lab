import { chromium } from "@playwright/test";

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 100)));
await p.goto("http://localhost:3000/scene-preview", { waitUntil: "networkidle" });

const info = await p.evaluate(() => {
  const names = new Set();
  document.querySelectorAll("*").forEach((el) => {
    for (const a of Array.from(el.attributes)) if (a.name.startsWith("data-")) names.add(a.name);
  });
  return {
    attrNames: [...names],
    demo: [...document.querySelectorAll("[data-demo-id]")].map((e) => e.getAttribute("data-demo-id")).slice(0, 24),
  };
});
console.log("ATTRS:", JSON.stringify(info.attrNames));
console.log("DEMO:", JSON.stringify(info.demo));

const reagent = p.locator("[data-reagent]").first();
const vessel = p.locator("[data-vessel]").first();
console.log("reagent/vessel:", await reagent.count(), await vessel.count());
if ((await reagent.count()) && (await vessel.count())) {
  await reagent.dragTo(vessel);
  await p.waitForTimeout(1600);
  const body = await p.locator("body").innerText();
  console.log("事件条含现象词:", /沉淀|AgCl|气泡|变/.test(body));
}
console.log("errors:", JSON.stringify(errs));
await b.close();
