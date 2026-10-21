/**
 * /exp/exp09 点选投放高亮验收（单实例、串行）。
 *
 * 断言：
 *  1. 点试剂瓶 → [data-drop-target="true"] 数量 > 0
 *  2. 点锥形瓶 → 数量回 0，且事件条文案与拖拽路径逐字相同
 *  3. Esc 后数量回 0；点空白后数量回 0
 *  4. 全程 pageerror = 0
 */
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const URL = `${BASE}/exp/exp09`;
const BOTTLE = '[data-demo-id="demo-scene-reagent-naoh"]';
const FLASK = '[data-demo-id="demo-scene-drop-flask"]';

const results = [];
const errors = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` · ${detail}` : ""}`);
};

const countTargets = (page) => page.locator('[data-drop-target="true"]').count();
const caption = async (page) =>
  page.locator('[data-demo-id="demo-scene-event"] [class*="eventLine1"]').innerText().catch(() => "");

async function fresh(page) {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector(BOTTLE, { timeout: 60_000 });
  await page.waitForTimeout(250);
}

async function main() {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/WebSocket|_next\/hmr|401|Failed to load resource/.test(t)) errors.push(t.slice(0, 160));
  });

  // 1. 点选 → 器皿进入可投放态
  await fresh(page);
  const before = await countTargets(page);
  await page.locator(BOTTLE).click();
  await page.waitForTimeout(120);
  const picked = await countTargets(page);
  const pickedAttr = await page.locator(FLASK).getAttribute("data-drop-target");
  check("/exp/exp09 点瓶后器皿 data-drop-target", before === 0 && picked > 0 && pickedAttr === "true", `${before} → ${picked}`);

  // 2. 点器皿 → 清零 + 文案
  await page.locator(FLASK).click();
  await page.waitForTimeout(150);
  const clickCount = await countTargets(page);
  const clickText = await caption(page);
  check("点器皿后高亮清零", clickCount === 0, String(clickCount));
  check("点选路径事件条有文案", clickText.length > 0, clickText.slice(0, 40));

  // 3. 拖拽路径文案
  await fresh(page);
  await page.dragAndDrop(BOTTLE, FLASK, { timeout: 15_000 });
  await page.waitForTimeout(150);
  const dragCount = await countTargets(page);
  const dragText = await caption(page);
  check("拖拽后高亮清零", dragCount === 0, String(dragCount));
  check("拖拽/点选文案逐字相同", dragText === clickText, dragText.slice(0, 40));

  // 4. Esc 取消
  await fresh(page);
  await page.locator(BOTTLE).click();
  await page.waitForTimeout(100);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(120);
  const escCount = await countTargets(page);
  check("Esc 取消后高亮清零", escCount === 0, String(escCount));

  // 5. 点空白取消
  await fresh(page);
  await page.locator(BOTTLE).click();
  await page.waitForTimeout(100);
  await page.locator(`[class*="benchSurface"]`).first().click({ force: true });
  await page.waitForTimeout(120);
  const blankCount = await countTargets(page);
  check("点空白后高亮清零", blankCount === 0, String(blankCount));

  check("全程 pageerror = 0", errors.length === 0, errors[0] ?? "");
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`);
  if (failed.length) {
    console.log("失败项：", failed.map((f) => f.name).join("；"));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
