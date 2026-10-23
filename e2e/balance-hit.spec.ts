import { expect, test } from "@playwright/test";
import { BALANCE_ART } from "../components/exp/scene/bench-layout";

/**
 * 天平的命中区必须盖住「画出来的整个图形」（用户 2026-10-23：
 * 「CDP 坐标点会打在图形左边界」点下去没反应；后来又说「命中区比图形小一圈」）。
 *
 * 根因有两层：
 * 1. 天平画的是线框 + 文字，中间大片是空的。SVG 只对「画了填充/描边」的地方做命中测试，
 *    所以 bbox 左右两侧（底座圆角外、防风罩框内）点下去会漏到台面矩形上，等于点空。
 *    修法：`<rect data-balance-hit>` 透明热区（`fill: transparent`；`fill: none` 不参与命中）。
 * 2. 热区尺寸原来手写成 132×126 = 绘制几何外沿，但底座/防风罩的描边宽 1.6（半宽 0.8）是往外画的
 *    —— 图形最外那一圈描边落在热区之外，点上去没反应（实测边缘外 0.5px = MISS）。
 *    修法：热区由 `balanceHitBox()`（`BALANCE_ART` + 描边半宽 + 1 单位余量）算，不再手写第二组数字。
 *
 * 第二条用例就是防第 2 层回归：命中区**每一边都不许比图形小**，
 * 且在图形边缘外 0.5px 采样必须命中（改前这一圈全是 MISS）。
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

test("命中区不小于图形：四边都盖住，且图形边缘外 0.5px 也点得到", async ({ page }) => {
  await page.goto("/exp/exp01?force=1");
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return Boolean(el && Object.keys(el).some((k) => k.startsWith("__react")));
    },
    BALANCE,
    { timeout: 20000 },
  );
  // 等入场动画停：量到一半布局还在挪，采样点会跟包围盒错开（并行跑时最容易撞上）
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const prev = (window as unknown as { __bal?: number[] }).__bal;
      (window as unknown as { __bal?: number[] }).__bal = [r.x, r.y, r.width, r.height];
      return Boolean(
        prev &&
          Math.abs(prev[0] - r.x) < 0.01 &&
          Math.abs(prev[1] - r.y) < 0.01 &&
          Math.abs(prev[2] - r.width) < 0.01,
      );
    },
    BALANCE,
    { timeout: 10000 },
  );

  // 量包围盒 + 亚像素采样放在同一个 evaluate 里：中间不让布局有机会变
  // （图形 = 所有绘制子元素，排除热区自身；命中区 = data-balance-hit）
  const { hit, art, dead } = await page.evaluate((sel) => {
    const g = document.querySelector(sel)!;
    const hitEl = g.querySelector("[data-balance-hit]")!;
    const hr = hitEl.getBoundingClientRect();
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const child of Array.from(g.children)) {
      if (child === hitEl) continue;
      const cr = child.getBoundingClientRect();
      if (cr.width === 0 && cr.height === 0) continue;
      l = Math.min(l, cr.left);
      t = Math.min(t, cr.top);
      r = Math.max(r, cr.right);
      b = Math.max(b, cr.bottom);
    }
    const midX = (l + r) / 2;
    const midY = (t + b) / 2;
    // 只在桌面尺度做亚像素采样（移动端整台天平才 40px 宽，半像素没意义）
    const points =
      hr.width >= 80
        ? [
            { name: "left", x: l - 0.5, y: midY },
            { name: "right", x: r + 0.5, y: midY },
            { name: "top", x: midX, y: t - 0.5 },
            { name: "bottom", x: midX, y: b + 0.5 },
          ]
        : [];
    const deadSides = points
      .filter((p) => {
        const el = document.elementFromPoint(p.x, p.y);
        return !el || !el.closest('[data-demo-id="demo-scene-instrument-balance"]');
      })
      .map((p) => p.name);
    return {
      hit: { left: hr.left, top: hr.top, right: hr.right, bottom: hr.bottom, width: hr.width, height: hr.height },
      art: { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t },
      dead: deadSides,
    };
  }, BALANCE);
  expect(art.width, "应该量到绘制范围").toBeGreaterThan(20);
  /** 1 个局部单位 = 多少屏幕像素（命中区与图形都在同一个 scale(1.2) 的 <g> 里，共用这个比例） */
  const unitPx = art.width / BALANCE_ART.w;

  // 1) 数值口径：命中区每一边都不许比图形小（0.5px 容差给子像素渲染）
  expect(hit.left, "命中区左沿比图形小").toBeLessThanOrEqual(art.left + 0.5);
  expect(hit.top, "命中区上沿比图形小").toBeLessThanOrEqual(art.top + 0.5);
  expect(hit.right, "命中区右沿比图形小").toBeGreaterThanOrEqual(art.right - 0.5);
  expect(hit.bottom, "命中区下沿比图形小").toBeGreaterThanOrEqual(art.bottom - 0.5);
  // 2) 得真的比图形大一圈（不是刚好齐边），但又不许乱扩把旁边洗涤槽的点击吞掉（每边 ≤4 单位）
  expect(hit.width, "命中区没多盖出描边那一圈").toBeGreaterThan(art.width);
  expect(hit.height, "命中区没多盖出描边那一圈").toBeGreaterThan(art.height);
  expect(hit.left, "命中区往左扩过头了").toBeGreaterThanOrEqual(art.left - 4 * unitPx);
  expect(hit.top, "命中区往上扩过头了").toBeGreaterThanOrEqual(art.top - 4 * unitPx);
  expect(hit.right, "命中区往右扩过头了").toBeLessThanOrEqual(art.right + 4 * unitPx);
  expect(hit.bottom, "命中区往下扩过头了").toBeLessThanOrEqual(art.bottom + 4 * unitPx);

  // 3) 行为口径：图形四条边外 0.5px 的点必须还能点中 —— 改前这一圈是 MISS。
  expect(dead, "图形边缘外 0.5px 点空了 = 命中区比图形小一圈").toEqual([]);
});
