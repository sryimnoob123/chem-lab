import { chromium } from "@playwright/test";

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 120)));
await p.goto("http://localhost:3000/scene-preview", { waitUntil: "networkidle" });

const drag = async (reagent, vessel) => {
  await p
    .locator(`[data-demo-id="demo-scene-reagent-${reagent}"]`)
    .dragTo(p.locator(`[data-demo-id="demo-scene-vessel-${vessel}"]`));
  await p.waitForTimeout(1500);
  return (await p.locator('[data-demo-id="demo-scene-event"]').innerText().catch(() => "")).trim();
};

console.log("AgNO3→flask:", await drag("agno3", "flask"));
console.log("CuSO4→beaker:", await drag("cuso4", "beaker"));
console.log("Na2CO3→tube-a:", await drag("na2co3", "tube-a"));
console.log("AgNO3→burette(应拒收):", await drag("agno3", "burette"));

for (const fx of ["explosion", "toxic-gas", "boil-over"]) {
  const btn = p.locator(`[data-demo-id="demo-fx-${fx}-trigger"]`);
  if (await btn.count()) {
    await btn.click();
    await p.waitForTimeout(300);
    const on = await p.locator("[data-fx-active]").count();
    console.log(`fx ${fx}: active=${on}`);
    await p.waitForTimeout(1600);
  } else {
    console.log(`fx ${fx}: 按钮缺失`);
  }
}
console.log("errors:", JSON.stringify(errs));
await b.close();
