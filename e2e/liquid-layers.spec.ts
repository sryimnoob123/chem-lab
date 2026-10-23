import { expect, test } from "@playwright/test";

/**
 * 液体分层（B2）在**真实页面**里生效的守卫。
 *
 * 单测只能证明 JSX 里画了这些节点；这里证明四件事：
 *   ① 有液体的器皿真的挂了「底色 / 上层明带 / 下层沉色 / 液面盘 / 反光带 / 远端亮弧 / 弯月面」七层；
 *   ② 远端亮弧的描边是**渐变**（CSS 里写一句 stroke 就会把它整条盖成常量白，B1 在瓶口高光上踩过），
 *      且渐变峰值给到 1 —— 用户口径「液面那圈不够亮」，压到 0.9 以下肉眼就没了；
 *   ③ 渐变 token 解析成了真颜色（`var(--canvas-liquid-*)` 拼错时浏览器给 rgb(0,0,0)，纸白场上是一块脏灰）；
 *   ④ 器底沉淀只给**真沉底**的固相画：Cu(OH)₂ 有，CO₂ 逸出没有（气体不沉底，画了就是化学错误）。
 *
 * 像素级「液面比液柱亮多少」在 `scripts/liquid-layers-measure.mjs`（改前后各跑一次），这里不重复。
 */

const LIQUID_PAGE = "/exp/exp03?force=1";
const LAYERS = [
  "body",
  "sheen-top",
  "deep",
  "surface",
  "surface-sheen",
  "surface-rim",
  "meniscus",
] as const;

/** 沉淀场景：烧杯里 种子 NaOH + 水 + CuSO₄ → Cu(OH)₂ 浅蓝沉淀（拖拽走不到的态，走 QA 钩子）。 */
const SEDIMENT_PAGE = "/scene-preview?contents=beaker=naoh,cuso4,water";
/** 气体场景：Na₂CO₃ + HCl → CO₂ 冒泡，不沉底。 */
const GAS_PAGE = "/scene-preview?contents=beaker=na2co3,hcl,water";

async function openBench(page: import("@playwright/test").Page, url: string, vessel: string) {
  await page.goto(url);
  await page.waitForFunction(
    (id) => Boolean(document.querySelector(`[data-vessel-art='${id}']`)),
    vessel,
    { timeout: 20000 },
  );
}

test("有液体的器皿挂满七层，液面反光带与远端亮弧都在", async ({ page }) => {
  await openBench(page, LIQUID_PAGE, "beaker");

  for (const vessel of ["beaker", "volumetric"] as const) {
    for (const layer of LAYERS) {
      await expect(
        page.locator(`[data-vessel-art='${vessel}'] [data-liquid-layer='${layer}']`),
        `${vessel} 缺 ${layer} 层`,
      ).toHaveCount(1);
    }
  }
});

test("远端亮弧：描边是渐变（没被 CSS 盖成常量白）、峰值 ≥0.9、只画上半圈", async ({ page }) => {
  await openBench(page, LIQUID_PAGE, "beaker");

  const rim = await page.evaluate(() => {
    const el = document.querySelector("[data-vessel-art='beaker'] [data-liquid-layer='surface-rim']");
    if (!el) return null;
    const style = getComputedStyle(el);
    const stops = Array.from(el.closest("svg")!.querySelectorAll("linearGradient")).find((g) =>
      (style.stroke ?? "").includes(`#${g.id}`),
    );
    return {
      stroke: style.stroke,
      width: Number.parseFloat(style.strokeWidth),
      d: el.getAttribute("d") ?? "",
      peak: stops
        ? Math.max(...Array.from(stops.querySelectorAll("stop")).map((s) => Number(s.getAttribute("stop-opacity") ?? "0")))
        : -1,
    };
  });

  expect(rim, "烧杯液面上应有远端亮弧").not.toBeNull();
  // CSS 的 stroke 会盖掉属性：必须是 url(#liqRim-…)，不是 rgb(255,255,255)
  // 注意 computed style 会把 url 里的 id 加引号：url("#liqRim-…")，正则要放过引号
  expect(rim!.stroke, "亮弧描边必须是渐变").toMatch(/^url\(["']?#liqRim-/);
  expect(rim!.width, "亮弧太细就看不见").toBeGreaterThanOrEqual(1.5);
  expect(rim!.peak, "亮弧峰值被压暗了（液面那圈又不够亮了）").toBeGreaterThanOrEqual(0.9);
  // 只画上半圈：sweep=1，整圈描亮会读成「液面套了个白圈」
  expect(rim!.d).toMatch(/^M [\d.-]+ [\d.-]+ A [\d.]+ [\d.]+ 0 0 1 /);
});

test("液体分层的 token 解析成了真颜色（没拼错、没退回黑色）", async ({ page }) => {
  await openBench(page, LIQUID_PAGE, "beaker");

  const gradients = await page.evaluate(() => {
    const art = document.querySelector("[data-vessel-art='beaker']");
    const out: { id: string; colors: string[] }[] = [];
    for (const gradient of Array.from(art?.querySelectorAll("linearGradient") ?? [])) {
      if (!/^liq(Surf|Rim|Deep|Top|Sed)-/.test(gradient.id)) continue;
      out.push({
        id: gradient.id,
        colors: Array.from(gradient.querySelectorAll("stop")).map((s) => getComputedStyle(s).stopColor),
      });
    }
    return out;
  });

  expect(gradients.length, "烧杯上应有液面反光/亮弧/沉色等液体渐变").toBeGreaterThanOrEqual(3);
  for (const { id, colors } of gradients) {
    expect(colors.length, `${id} 的 stop 数量`).toBeGreaterThanOrEqual(2);
    for (const color of colors) {
      expect(color, `${id} 的 stop-color 没解析`).not.toBe("rgb(0, 0, 0)");
      expect(color).toMatch(/^rgba?\(/);
    }
  }
});

test("器底沉淀只给真沉底画：Cu(OH)₂ 有，CO₂ 逸出没有", async ({ page }) => {
  await openBench(page, SEDIMENT_PAGE, "beaker");
  await expect(
    page.locator("[data-vessel-art='beaker'] [data-liquid-layer='sediment']"),
    "Cu(OH)₂ 该画器底沉淀层",
  ).toHaveCount(1);
  await expect(
    page.locator("[data-vessel-art='beaker'] [data-liquid-layer='sediment-edge']"),
    "沉淀堆顶分界线",
  ).toHaveCount(1);

  // 沉淀层必须压在液面之下、贴着器底（y 越大越靠下）
  const order = await page.evaluate(() => {
    const art = document.querySelector("[data-vessel-art='beaker']");
    const box = (sel: string) => {
      const el = art?.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    };
    return { surface: box("[data-liquid-surface]"), sediment: box("[data-liquid-layer='sediment']") };
  });
  expect(order.surface && order.sediment).toBeTruthy();
  expect(order.sediment!.top).toBeGreaterThan(order.surface!.top);

  await openBench(page, GAS_PAGE, "beaker");
  await expect(
    page.locator("[data-vessel-art='beaker'] [data-liquid-layer='sediment']"),
    "CO₂ 逸出不沉底，不该画沉淀层",
  ).toHaveCount(0);
});
