import { expect, test, type Page } from "@playwright/test";

/**
 * 右侧安全边（2026-10-23）：
 * 任务看板 / 错误演示是浮在台面上的 HTML 卡（右对齐、固定 px 宽），
 * 台面却是等宽缩放的 SVG —— 视口一窄，托盘右端与最右那台器皿就钻到卡片底下。
 * 实测被压：1152 宽托盘 21px、1024 宽锥形瓶 28px。
 *
 * 这里锁三件事：
 *   ① 任何视口下托盘右端都在右栏左侧（留 ≥6px 净空）；
 *   ② 任何视口下器皿右沿都在右栏左侧；
 *   ③ 器皿整体左移之后，动作层的水流仍然落在瓶身里（锚点跟着位移走）。
 */

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1152, height: 720 },
  { width: 1024, height: 700 },
];

const hydraulic = async (page: Page) => {
  await page.waitForFunction(
    () => {
      const n = document.querySelector('[data-vessel-id="volumetric"]') as HTMLElement | null;
      return Boolean(n && Object.keys(n).some((k) => k.startsWith("__react")));
    },
    null,
    { timeout: 20000 },
  );
};

for (const vp of VIEWPORTS) {
  test(`右侧器具不钻到浮层底下 ${vp.width}×${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto("/exp/exp01?force=1");
    await hydraulic(page);
    // 等右栏量测生效（useSafeRight 在 layout effect 里量一次）
    await page.waitForTimeout(400);

    const rail = (await page.locator("[data-rail]").boundingBox())!;
    const tray = (await page.locator('[data-demo-id="demo-tool-tray"]').boundingBox())!;
    expect(rail.x, "右栏应在台面右侧（不是窄屏底部那版）").toBeGreaterThan(vp.width * 0.5);
    expect(tray.x + tray.width, "托盘右端不许进到右栏底下").toBeLessThanOrEqual(rail.x - 6);

    const rightmost = await page.evaluate(() => {
      const ids = ["beaker", "tube-a", "tube-b", "volumetric", "flask"];
      const railEl = document.querySelector("[data-rail]")!;
      const railLeft = railEl.getBoundingClientRect().left;
      return ids
        .map((id) => {
          const el = document.querySelector(`[data-demo-id="demo-scene-vessel-${id}"]`);
          return el ? { id, right: el.getBoundingClientRect().right } : null;
        })
        .filter(Boolean)
        .map((v) => ({ id: v!.id, over: Math.round(v!.right - railLeft) }));
    });
    const over = rightmost.filter((v) => v.over > -2);
    expect(over, `这些器皿压在右栏上：${JSON.stringify(over)}`).toEqual([]);
  });
}

test("1024 宽下动作水流仍落在瓶身里（锚点跟着版面位移）", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 700 });
  await page.goto("/exp/exp01?force=1");
  await hydraulic(page);
  await page.waitForTimeout(400);

  const vessel = page.locator('[data-vessel-id="volumetric"]');
  const sink = page.locator('[data-drop-kind="sink"]').first();
  const vb = (await vessel.boundingBox())!;
  const sb = (await sink.boundingBox())!;
  await page.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i += 1) {
    await page.mouse.move(
      vb.x + vb.width / 2 + ((sb.x + sb.width / 2) - (vb.x + vb.width / 2)) * (i / 12),
      vb.y + vb.height / 2 + ((sb.y + sb.height / 2) - (vb.y + vb.height / 2)) * (i / 12),
    );
    await page.waitForTimeout(16);
  }
  await page.mouse.up();

  await page.waitForSelector('[data-a="water"]', { timeout: 12000 });
  const geom = await page.evaluate(() => {
    const water = document.querySelector('[data-a="water"]')!;
    const glass = document.querySelector('[data-vessel-id="volumetric"] > g')!;
    const rb = (el: Element) => el.getBoundingClientRect();
    const w = rb(water);
    const g = rb(glass);
    return {
      waterCenter: w.x + w.width / 2,
      glassLeft: g.x,
      glassRight: g.x + g.width,
      glassWidth: g.width,
    };
  });
  expect(geom.glassWidth).toBeGreaterThan(20);
  expect(
    geom.waterCenter,
    `洗涤水流中线 ${Math.round(geom.waterCenter)} 应落在瓶身 ${Math.round(geom.glassLeft)}..${Math.round(geom.glassRight)} 内`,
  ).toBeGreaterThan(geom.glassLeft);
  expect(geom.waterCenter).toBeLessThan(geom.glassRight);
});
