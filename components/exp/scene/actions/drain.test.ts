import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildDrain } from "./drain";
import { anchorOf, type VesselAnchor } from "./geometry";

/**
 * 排液动作（2026-10-23 用户口径：倒水之后不能直接消失，要有倒掉/吸走的过程）。
 *
 * 这条动作的位置在框架里是固定的：`SceneAction["kind"] === "drain"`，
 * 由 bench-scene 在 rinse / dilute 结束时接一拍，播完才把器皿送回原位。
 * 这里守三件事：
 *   1. 画出来的东西里必须有那三样：器内水层、倒出的水带、落点水花；
 *   2. clipPath 只挂在「不动的外层 g」上，里面不许出现 transform（沿用 rinse 的坑）；
 *   3. 时长给足，节奏跟着 beat 走，水带和液面是同时收的。
 */

function anchor(id: string): VesselAnchor {
  const a = anchorOf(id);
  if (!a) throw new Error(`${id} 不在 SCENE_VESSELS 里，几何数据坏了`);
  return a;
}

const html = (scene: { node: unknown }) => renderToStaticMarkup(scene.node as React.ReactElement);

describe("buildDrain", () => {
  it("画出水层、倒出的水带和落点水花", () => {
    const out = html(buildDrain(anchor("volumetric"), { clipId: "drain-1" }));
    expect(out).toContain('data-a="water"');
    expect(out).toContain('data-a="dump"');
    expect(out).toContain('data-a="splash"');
    expect(out).toContain('id="drain-1"');
  });

  it("clipPath 里只有 d，没有 transform（裁剪不跟液体一起挪）", () => {
    const out = html(buildDrain(anchor("beaker"), { clipId: "drain-2" }));
    const clip = out.slice(out.indexOf("<clipPath"), out.indexOf("</clipPath>") + 11);
    expect(clip).not.toContain("transform");
    expect(clip).toContain("<path");
  });

  it("三条 beat：水带 / 液面 / 水花，总时长够把水排空", () => {
    const scene = buildDrain(anchor("beaker"), { clipId: "drain-3" });
    expect(scene.beats.map((b) => b.sel)).toEqual(['[data-a="dump"]', '[data-a="water"]', '[data-a="splash"]']);
    expect(scene.ms).toBeGreaterThanOrEqual(600);
    const water = scene.beats.find((b) => b.sel === '[data-a="water"]');
    expect(water?.frames.at(-1)?.opacity).toBe(0);
  });
});
