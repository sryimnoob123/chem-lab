import { expect, test, type Page } from "@playwright/test";

/**
 * 「加错试剂也能过」的回归守卫（用户 2026-10-23 实测出来的教学事故）。
 *
 * 背景：学生把**浓硫酸**拖进烧杯，第 4 步照样判「这一步做完了」——
 * 因为旧实现只看本步动作类型（dissolve/dilute…），不看倒的是哪一瓶。
 * 现在走 resolveDrop（文案 / 化学式 / params.reagent 三路比对），不匹配就拒收。
 *
 * 另外顺带守一条读数：第 2 步（空载 0.0000 g）和第 3 步（差减 1.0599 g）天平示数必须不同，
 * 否则学生看不出这两步干了什么。
 */

const KEY_WAIT = 900;

/** 走到第 N 步：exp01 七步各有 1 个正确动作，键盘序号都是 1（陷阱排在正确项之后，不会误触） */
async function walkToStep(page: Page, target: number) {
  for (let i = 0; i < target - 1; i += 1) {
    await page.keyboard.press("1");
    await page.waitForTimeout(KEY_WAIT);
  }
}

const stepOf = (page: Page) =>
  page.evaluate(() => {
    const m = (document.querySelector("[class*='topStep']")?.textContent ?? "").match(/第\s*(\d+)\s*步/);
    return m ? Number(m[1]) : 0;
  });

/** 把某瓶试剂拖到「本步指定器皿」（data-cue=true）；没有指定器皿就退到 fallback */
async function dragReagent(page: Page, reagentId: string, fallbackVessel = "beaker") {
  const src = page.locator(`[data-demo-id='demo-scene-reagent-${reagentId}']`).first();
  const box = await src.boundingBox();
  expect(box, `试剂架上应该有 ${reagentId}`).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 18, box!.y + box!.height / 2 + 10, { steps: 4 });

  const spot = await page.evaluate((fallback) => {
    const pick = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height * 0.6 };
    };
    const cue = document.querySelector("[data-drop-kind='vessel'][data-cue='true']");
    return pick(cue) ?? pick(document.querySelector(`[data-demo-id='demo-scene-vessel-${fallback}']`));
  }, fallbackVessel);
  expect(spot, "找不到可落的器皿").toBeTruthy();
  await page.mouse.move(spot!.x, spot!.y, { steps: 10 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

test("第 4 步：倒错试剂被拒收，倒水才过", async ({ page }) => {
  await page.goto("/exp/exp01?force=1");
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-demo-id='demo-finish']");
      return Boolean(el && Object.keys(el).some((k) => k.startsWith("__react")));
    },
    null,
    { timeout: 20000 },
  );

  await walkToStep(page, 4);
  expect(await stepOf(page), "应停在第 4 步").toBe(4);

  // 第 3 步差减称量做完 → 天平示数必须变成 1.0599（不是恒 0.0000）
  await expect(page.locator("[data-balance-readout]")).toHaveText("1.0599 g");

  // ① 浓硫酸：不该被接受
  await dragReagent(page, "h2so4-conc");
  await expect(page.locator("[data-demo-id='demo-reject-hint']")).toBeVisible({ timeout: 5000 });
  expect(await stepOf(page), "倒错试剂不能推进步骤").toBe(4);

  // ② 蒸馏水：这一步要的就是它
  await dragReagent(page, "water");
  await expect.poll(() => stepOf(page), { timeout: 8000 }).toBe(5);
});
