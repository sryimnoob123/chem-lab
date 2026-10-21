import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SceneOutcome, SceneVessel } from "@/lib/scene/types";
import { GlassVessel } from "./glass-vessel";
import { VesselArt } from "./index";
import { vesselBubbles } from "@/lib/scene/vessel-paint";

const beaker: SceneVessel = { id: "beaker", kind: "beaker", label: "烧杯", x: 404, y: 205, w: 116, h: 135 };

function render(node: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(node);
}

describe("玻璃器皿 2.5D 结构（SSR 冒烟）", () => {
  it("三层质感都在：玻璃渐变 / 内侧裁切亮边 / 底部反光弧", () => {
    const html = render(createElement(GlassVessel, { vessel: beaker, contents: ["water"] }));
    expect(html).toContain("linearGradient");
    expect(html).toContain("clipPath");
    expect(html).toContain("glass-outline");
    // 底部反光弧：beaker 的弧线终点在 130,182
    expect(html).toContain("Q80 190 130 182");
    expect(html).toContain("translate(404 205) scale(0.72)");
  });

  it("液体：上浅下深叠层 + 液面细椭圆 + 3~6 个常驻气泡", () => {
    const html = render(createElement(GlassVessel, { vessel: beaker, contents: ["water"] }));
    expect(html).toContain("0.18"); // 纵深渐变中段
    expect(html).toContain("0.62"); // 纵深渐变底部
    expect(html).toContain("<ellipse");
    const bubbles = vesselBubbles("beaker").length;
    expect(html.match(/--bubble-dur/g)?.length).toBe(bubbles);
    expect(bubbles).toBeGreaterThanOrEqual(3);
    expect(bubbles).toBeLessThanOrEqual(6);
  });

  it("空器皿不画液体与气泡（避免空瓶里冒泡）", () => {
    const html = render(createElement(GlassVessel, { vessel: beaker, contents: [] }));
    expect(html).not.toContain("--bubble-dur");
    // 只剩接地阴影 + 瓶口两个椭圆，没有液面
    expect(html.match(/<ellipse/g)?.length).toBe(2);
  });

  it("白色沉淀被压成暖灰白，不会在白玻璃上消失", () => {
    const html = render(createElement(GlassVessel, { vessel: beaker, contents: ["agno3", "nacl"] }));
    expect(html.toUpperCase()).toContain("#EDEAE1");
    expect(html.toUpperCase()).not.toContain("FILL:#FFFFFF");
  });

  it("VesselArt 把变色终态色透传给液体", () => {
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
      }),
    );
    expect(html.toUpperCase()).toContain("#F48FB1");
    expect(html).toContain('data-vessel-kind="beaker"');
  });

  it("滴定管不画常驻气泡，但仍有三层描边", () => {
    const burette: SceneVessel = { id: "burette", kind: "burette", label: "滴定管", x: 48, y: 100, w: 84, h: 239 };
    const html = render(createElement(GlassVessel, { vessel: burette, contents: [] }));
    expect(html).not.toContain("--bubble-dur");
    expect(html).toContain("clipPath");
    expect(html).toContain("Q60 298 71 292");
  });
});
