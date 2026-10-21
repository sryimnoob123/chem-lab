/**
 * exp01 场景资产验收（单实例、串行）：/scene-preview
 *
 *  1. 容量瓶已渲染，且点选试剂后进入 data-drop-target（5 个可投放器皿同帧高亮）
 *  2. 分析天平静态外形存在（data-demo-id="demo-scene-instrument-balance"），且不接受投加
 *  3. 三个 exp01 货架条目存在，旧 id 未改名
 *  4. 拖拽 蒸馏水 → 容量瓶 可完成一次投放（有事件条）
 *  5. 全程 pageerror = 0
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const OUT = path.join(os.tmpdir(), "chemlab-shots");

const results = [];
const errors = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` · ${detail}` : ""}`);
};

const eventText = async (page) =>
  (await page.locator('[data-demo-id="demo-scene-event"]').innerText()).replace(/\s+/g, " ");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));

  await page.goto(`${BASE}/scene-preview`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector('[data-demo-id="demo-scene-vessel-volumetric"]', { timeout: 60_000 });
  await page.waitForTimeout(400);

  const volumetricBox = await page.locator('[data-demo-id="demo-scene-vessel-volumetric"]').boundingBox();
  check("容量瓶已渲染", Boolean(volumetricBox), volumetricBox ? `${Math.round(volumetricBox.width)}×${Math.round(volumetricBox.height)}` : "无包围盒");

  // 点选 蒸馏水 → 可投放器皿全部高亮（含容量瓶）
  await page.locator('[data-demo-id="demo-scene-reagent-water"]').click();
  await page.waitForTimeout(250);
  const targetCount = await page.locator('[data-drop-target="true"]').count();
  const volumetricTarget = await page.locator('[data-demo-id="demo-scene-vessel-volumetric"] [data-drop-target="true"]').count();
  check("点选后容量瓶进入 data-drop-target", volumetricTarget > 0, `容量瓶 ${volumetricTarget} 个环 / 全台 ${targetCount} 个`);
  check("可投放器皿同帧高亮（flask/beaker/tube-a/tube-b/volumetric = 5）", targetCount === 5, String(targetCount));

  const balanceCount = await page.locator('[data-demo-id="demo-scene-instrument-balance"]').count();
  const balanceTarget = await page.locator('[data-demo-id="demo-scene-instrument-balance"] [data-drop-target="true"]').count();
  check("分析天平静态外形存在且不接收投加", balanceCount === 1 && balanceTarget === 0, `${balanceCount} / ${balanceTarget}`);

  const rackIds = await page
    .locator('[data-demo-id^="demo-scene-reagent-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-demo-id")));
  check(
    "三个 exp01 货架条目存在、旧 id 未改名",
    ["na2co3-solid", "h2so4-conc", "water"].every((id) => rackIds.includes(`demo-scene-reagent-${id}`)) &&
      rackIds.includes("demo-scene-reagent-na2co3") &&
      rackIds.includes("demo-scene-reagent-h2so4"),
    String(rackIds.length),
  );

  await page.locator('[data-demo-id="demo-scene-root"]').screenshot({ path: path.join(OUT, "exp01-assets.png") });

  // 拖拽 蒸馏水 → 容量瓶
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  await page.dragAndDrop('[data-demo-id="demo-scene-reagent-water"]', '[data-demo-id="demo-scene-vessel-volumetric"]', { timeout: 15_000 });
  await page.waitForTimeout(200);
  const text = await eventText(page);
  check("拖拽 蒸馏水 → 容量瓶 有事件条反馈", text.length > 0, text.slice(0, 42));

  check("全程 pageerror = 0", errors.length === 0, errors[0] ?? "");
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`);
  console.log(`截图：${path.join(OUT, "exp01-assets.png")}`);
  if (failed.length) {
    console.log("失败项：", failed.map((f) => f.name).join("；"));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
