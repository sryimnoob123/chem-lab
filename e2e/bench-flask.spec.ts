import { expect, test, type Page } from "@playwright/test";

/**
 * 「指引说的器皿，台面上真的存在」的回归守卫（用户 2026-10-23 教学报告 M4）。
 *
 * 背景：第 6 步的指引写着「移取 25.00 mL 放入锥形瓶」，但 exp01 的台面只有
 * 烧杯 / 两支试管 / 容量瓶 —— 学生拿着移液管没有落点，而且场景高亮（data-cue）
 * 按「transfer 默认器皿」指到了容量瓶上（指引和场景互相打脸）。
 *
 * 现在台面加了锥形瓶（palette flask 挪到容量瓶右侧空位），第 6 步的正确动作
 * 文案也点名了锥形瓶，高亮必须落在它身上。
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

test("第 6 步：台面上有锥形瓶，高亮指向它且不被右侧面板压住", async ({ page }) => {
  await page.goto("/exp/exp01?force=1");
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-demo-id='demo-finish']");
      return Boolean(el && Object.keys(el).some((k) => k.startsWith("__react")));
    },
    null,
    { timeout: 20000 },
  );

  // ① 台面上真的有锥形瓶，而且能点（可投放）
  const flask = page.locator("[data-vessel-id='flask']");
  await expect(flask).toBeVisible();
  await expect(flask).toHaveAttribute("data-drop-kind", "vessel");

  // ② 不被右侧「任务 / 错误演示」浮层压住（压住 = 学生看得到却拖不进去）。
  //    桌面端浮层常驻压在台面右侧；移动端浮层折到台面下方，两轴都要相交才算压住。
  const overlap = await page.evaluate(() => {
    const panel = document.querySelector("[data-demo-id='demo-trap-panel']");
    const vessel = document.querySelector("[data-vessel-id='flask']");
    if (!panel || !vessel) return { missing: true, px: 0 };
    const a = vessel.getBoundingClientRect();
    const b = panel.getBoundingClientRect();
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return { missing: false, px: w > 0 && h > 0 ? Math.round(Math.min(w, h)) : 0 };
  });
  expect(overlap.missing, "台面上应有锥形瓶与右侧面板").toBe(false);
  expect(overlap.px, "锥形瓶不该钻到右侧面板底下").toBeLessThanOrEqual(0);

  // ③ 走到第 6 步：高亮必须是锥形瓶（不是容量瓶）
  await walkToStep(page, 6);
  expect(await stepOf(page), "应停在第 6 步").toBe(6);
  await expect(flask).toHaveAttribute("data-cue", "true");
  await expect(page.locator("[data-vessel-id='volumetric']")).toHaveAttribute("data-cue", "false");
  await expect(page.locator("[data-cue-vessel='flask']")).toHaveCount(1);
});
