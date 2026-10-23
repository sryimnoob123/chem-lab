import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SceneOutcome, SceneVessel } from "@/lib/scene/types";
import { GlassVessel, hasLiquidContent, solidColorOf } from "./glass-vessel";
import { VesselArt } from "./index";
import { VESSEL_SCALE, mouthOf } from "./vessel-geometry";

const beaker: SceneVessel = { id: "beaker", kind: "beaker", label: "烧杯", x: 404, y: 205, w: 116, h: 135 };

function render(node: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(node);
}

describe("玻璃器皿 2.5D（drag-pour 画法，SSR 冒烟）", () => {
  it("玻璃主体：实心暖白填充 + 双层描边 + 瓶口椭圆 + 接地阴影", () => {
    const html = render(createElement(GlassVessel, { vessel: beaker, contents: [] }));
    expect(html).toContain('data-vessel-art="beaker"');
    /* 别把 scale 写死：2026-10-23 器皿统一放大到 1.45 倍，写死的 0.72 让整包测试变红。
       断言画法，不断言数值 —— 数值从 VESSEL_SCALE 取。 */
    expect(html).toContain(`translate(${beaker.x} ${beaker.y}) scale(${VESSEL_SCALE.beaker})`);
    // 2026-10-23 实心玻璃：填充走 .glassBody，描边拆成 .glassEdgeOuter(2.6) / .glassEdgeInner(1.4)
    expect(html).toContain("glassBody");
    expect(html).toContain("glassEdgeOuter");
    expect(html).toContain("glassEdgeInner");
    expect(html).toContain('vector-effect="non-scaling-stroke"');
    /* 口沿：rx 写死，ry 由视角压缩比 VIEW_K 推（俯角 38°）。原来断言 ry="7" 是平视口径，
       那个值已经不存在了。 */
    const mouth = mouthOf("beaker");
    expect(html).toContain(`rx="${mouth.rx}"`);
    expect(html).toContain(`ry="${mouth.ry}"`);
    expect(html).toContain("radialGradient");
  });

  it("液体 = 矩形 + 液面椭圆，两层都被器皿轮廓裁（clipPath）", () => {
    const html = render(createElement(GlassVessel, { vessel: beaker, contents: ["water"], level: 0.4 }));
    expect(html).toContain('data-vessel-liquid="beaker"');
    expect(html).toContain("data-liquid-rect");
    expect(html).toContain("data-liquid-surface");
    expect(html).toContain("clipPath");
    expect(html).toContain('data-liquid-level="0.400"');
  });

  it("液位只挪矩形上沿：level 越高，y 越小、height 越大，下沿不动", () => {
    const low = render(createElement(GlassVessel, { vessel: beaker, contents: ["water"], level: 0.2 }));
    const high = render(createElement(GlassVessel, { vessel: beaker, contents: ["water"], level: 0.8 }));
    const read = (html: string) => {
      const match = html.match(/data-liquid-rect[^>]*?y="([\d.]+)"[^>]*?height="([\d.]+)"/);
      return match ? { y: Number(match[1]), h: Number(match[2]) } : null;
    };
    const a = read(low);
    const b = read(high);
    expect(a && b).toBeTruthy();
    expect(b!.y).toBeLessThan(a!.y);
    expect(b!.h).toBeGreaterThan(a!.h);
    expect(Math.round((a!.y + a!.h) * 10) / 10).toBe(186);
    expect(Math.round((b!.y + b!.h) * 10) / 10).toBe(186);
  });

  it("空器皿不画液体（避免空瓶里一片水）", () => {
    const html = render(createElement(GlassVessel, { vessel: beaker, contents: [], level: 0 }));
    expect(html).not.toContain("data-liquid-rect");
  });

  it("只有固体时铺一层器底粉末，不画液面", () => {
    const html = render(createElement(GlassVessel, { vessel: beaker, contents: ["na2co3"], level: 0 }));
    expect(html).not.toContain("data-liquid-rect");
    expect(html.toUpperCase()).toContain("#EDEAE1");
  });

  it("白色沉淀被压成暖灰白，不会在白玻璃上消失", () => {
    const html = render(createElement(GlassVessel, { vessel: beaker, contents: ["agno3", "nacl"], level: 0.4 }));
    expect(html.toUpperCase()).toContain("#EDEAE1");
    expect(html.toUpperCase()).not.toContain("FILL:#FFFFFF");
  });

  it("VesselArt 把液位与变色终态色透传给液体", () => {
    const outcome: SceneOutcome = {
      ok: true,
      fx: "color",
      caption: "酚酞遇碱变粉红",
      phenomena: { colorChange: { from: "", to: "", fromHex: "#FFFFFF", toHex: "#F48FB1" } },
    };
    const html = render(
      createElement(VesselArt, {
        vessel: beaker,
        contents: ["naoh", "phenolphthalein"],
        outcome,
        fxKey: 1,
        level: 0.5,
      }),
    );
    expect(html.toUpperCase()).toContain("#F48FB1");
    expect(html).toContain('data-vessel-kind="beaker"');
    expect(html).toContain('data-liquid-level="0.500"');
  });

  it("滴定管不画液体（只装标准溶液，液面由动作层驱动）", () => {
    const burette: SceneVessel = { id: "burette", kind: "burette", label: "滴定管", x: 48, y: 100, w: 84, h: 239 };
    const html = render(createElement(GlassVessel, { vessel: burette, contents: ["naoh"], level: 0.6 }));
    expect(html).not.toContain("data-liquid-rect");
    expect(html).toContain("clipPath");
  });
});

describe("内容物判定（纯函数）", () => {
  it("水 / 溶液算液体，纯固体不算", () => {
    expect(hasLiquidContent(["water"])).toBe(true);
    expect(hasLiquidContent(["na2co3"])).toBe(false);
    expect(hasLiquidContent(["na2co3", "water"])).toBe(true);
  });

  it("固体取第一瓶固体的颜色；白色固体给暖灰白", () => {
    expect(solidColorOf(["na2co3"])).toBe("#EDEAE1");
    expect(solidColorOf(["water"])).toBeNull();
  });
});
