import { expect, test } from "@playwright/test";

/**
 * 天平的命中区必须和图形一样大（用户 2026-10-23：
 * 「CDP 坐标点会打在图形左边界」—— 点下去没反应）。
 *
 * 根因：天平画的是线框 + 文字，中间大片是空的。SVG 只对「画了填充/描边」的地方做命中测试，
 * 所以 bbox 左右两侧（底座圆角外、防风罩框内）点下去会漏到台面矩形上，等于点空。
 * 修法：`<rect data-balance-hit>` 透明热区（fill: transparent）垫在绘制内容下面 ——
 * `fill: none` 不参与命中，所以必须用 transparent，不能跟着描边改成 none。
 */

const BALANCE = '[data-demo-id="demo-scene-instrument-balance"]';

test("天平命中区覆盖整个图形（含左右边界）", async ({ page }) => {
  await page.goto("/exp/exp01?force=1");
  // 等水合：React 接管后 SVG <g> 上才有 __reactProps（点下去才有 onClick）
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return Boolean(el && Object.keys(el).some((k) => k.startsWith("__react")));
    },
    BALANCE,
    { timeout: 20000 },
  );

  const g = page.locator(BALANCE);
  const box = (await g.boundingBox())!;
  expect(box.width, "天平应该有可见尺寸").toBeGreaterThan(28);
  expect(box.height).toBeGreaterThan(28);

  // 3×3 采样：各边内缩 2px（以前左右两侧这一圈全是漏的）
  const misses: string[] = [];
  for (const fx of [0.03, 0.5, 0.97]) {
    for (const fy of [0.03, 0.5, 0.97]) {
      const point = { x: box.x + box.width * fx, y: box.y + box.height * fy };
      const hit = await page.evaluate((p) => {
        const el = document.elementFromPoint(p.x, p.y);
        return Boolean(el?.closest('[data-demo-id="demo-scene-instrument-balance"]'));
      }, point);
      if (!hit) {
        misses.push(`${Math.round(fx * 100)}%/${Math.round(fy * 100)}% @${Math.round(point.x)},${Math.round(point.y)}`);
      }
    }
  }
  expect(misses, "天平图形范围内有采样点漏到台面上").toEqual([]);

  // 真点一次左边界（最典型的漏点）：第 1 步点天平，结果条要说「天平这里现在不用动」
  await page.mouse.click(box.x + 3, box.y + box.height / 2);
  await expect(page.locator('[data-demo-id="demo-scene-event"]')).toContainText("天平", { timeout: 5000 });
});
