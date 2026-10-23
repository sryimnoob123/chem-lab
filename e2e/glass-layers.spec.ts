import { expect, test } from "@playwright/test";

/**
 * 玻璃五层（B1）在**真实页面**里生效的守卫。
 *
 * 单测只能证明 JSX 里画了这几个节点；这里证明三件事：
 *   ① 四台器皿都真的挂了 tint / sheen / rim / mouth-rim 四个图层；
 *   ② sheen 走 `mix-blend-mode: screen` 且被主体轮廓 clip 住（否则白会糊住液体、溢出瓶颈）；
 *   ③ 渐变里的 token 真的解析成了颜色 —— `var(--canvas-glass-*)` 拼错时 stop-color 会变成黑色/初始值，
 *      在纸白场上就是"器皿突然变脏"，肉眼第一眼未必看得出来。
 *
 * 像素级「亮边比器身亮多少」在 `scripts/glass-layers-measure.mjs`（改前后各跑一次），这里不重复。
 */

const VESSELS = ["beaker", "tube-a", "volumetric", "flask"] as const;
const LAYERS = ["tint", "sheen", "rim", "mouth-rim"] as const;

test("四台器皿都挂了玻璃五层，sheen 走 screen 并被轮廓裁住", async ({ page }) => {
  await page.goto("/exp/exp01?force=1");
  await page.waitForFunction(() => Boolean(document.querySelector("[data-vessel-art='beaker']")), null, {
    timeout: 20000,
  });

  for (const id of VESSELS) {
    for (const layer of LAYERS) {
      await expect(
        page.locator(`[data-vessel-art='${id}'] [data-glass-layer='${layer}']`),
        `${id} 缺 ${layer} 层`,
      ).toHaveCount(1);
    }
  }

  const sheen = await page.evaluate(() => {
    const el = document.querySelector("[data-vessel-art='beaker'] [data-glass-layer='sheen']");
    if (!el) return null;
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return {
      blend: style.mixBlendMode,
      fill: style.fill,
      clip: el.getAttribute("clip-path") ?? "",
      w: Math.round(box.width),
      h: Math.round(box.height),
    };
  });
  expect(sheen, "烧杯上应有 sheen 层").not.toBeNull();
  expect(sheen!.blend, "sheen 必须是 screen 混合").toBe("screen");
  expect(sheen!.fill).toMatch(/^url\(/);
  expect(sheen!.clip).toMatch(/^url\(#clip-/);
  expect(sheen!.w).toBeGreaterThan(10);
  expect(sheen!.h).toBeGreaterThan(10);
});

test("玻璃五层的 token 解析成了真颜色（没拼错、没退回黑色）", async ({ page }) => {
  await page.goto("/exp/exp01?force=1");
  await page.waitForFunction(() => Boolean(document.querySelector("[data-vessel-art='beaker']")), null, {
    timeout: 20000,
  });

  const stops = await page.evaluate(() => {
    const art = document.querySelector("[data-vessel-art='beaker']");
    const out: { id: string; colors: string[] }[] = [];
    for (const gradient of Array.from(art?.querySelectorAll("linearGradient") ?? [])) {
      const id = gradient.id;
      if (!/^g(Tint|Rim|Sheen|Mouth)-/.test(id)) continue;
      const colors = Array.from(gradient.querySelectorAll("stop")).map(
        (stop) => getComputedStyle(stop).stopColor,
      );
      out.push({ id, colors });
    }
    return out;
  });

  expect(stops.length, "烧杯上应有 4 个玻璃渐变（tint/rim/sheen/mouth）").toBeGreaterThanOrEqual(4);
  for (const { id, colors } of stops) {
    expect(colors.length, `${id} 的 stop 数量`).toBeGreaterThanOrEqual(3);
    for (const color of colors) {
      // 关键断言：var() 写错时浏览器给 `rgb(0, 0, 0)` —— 纸白场上就是一块脏灰
      expect(color, `${id} 的 stop-color 没解析`).not.toBe("rgb(0, 0, 0)");
      expect(color).toMatch(/^rgba?\(/);
    }
  }
});
