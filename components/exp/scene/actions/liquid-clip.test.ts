import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { anchorOf, levelShift, type VesselAnchor } from "./geometry";
import { liquidBox } from "../vessels/vessel-geometry";
import { buildIncident, type IncidentOp } from "./incident";
import { buildRinse } from "./rinse";
import { buildDrops, buildStir } from "./stir";
import { buildTransfer } from "./transfer";

/**
 * 液体层裁剪（2026-10-23 实测的 bug 回归守卫）
 *
 * 旧写法把 `transform` 写在 clipPath 的子 `path` 上，Chrome 在这块台面 SVG 里直接忽略裁剪，
 * 洗涤 / 转移 / 搅拌的液体矩形整块溢出瓶外。修法：clipPath 用器皿局部坐标 + 外层 `<g transform>`。
 * 这里断言三件事：
 *   1. clipPath 里只有 `d`，没有任何 transform；
 *   2. 液体层确实在那个「translate + scale」的外层里（局部坐标才成立）；
 *   3. 局部坐标换算回去要落在原来的绝对位置上（液面不动、只是被裁住），
 *      液位位移也必须是局部单位（÷ scale），否则动画会走得比液面快/慢 scale 倍。
 */

function anchor(id: string): VesselAnchor {
  const a = anchorOf(id);
  if (!a) throw new Error(`${id} 不在 SCENE_VESSELS 里，几何数据坏了`);
  return a;
}

const html = (scene: { node: unknown }) => renderToStaticMarkup(scene.node as React.ReactElement);

/** clipPath 的内部标记（用于断言「里面没有 transform」）。 */
function clipInner(markup: string, id: string): string {
  const match = markup.match(new RegExp(`<clipPath id="${id}"[^>]*>([\\s\\S]*?)</clipPath>`));
  if (!match) throw new Error(`找不到 clipPath#${id}`);
  return match[1];
}

/** 取「外层器皿变换 g（带裁剪）+ 里面会动的液体 g」。动作层用 data-a，事故演出用 data-i。 */
function liquidBlock(
  markup: string,
  dataA: string,
  attr: "data-a" | "data-i" = "data-a",
): { transform: string; clip: string; open: string; inner: string } {
  const match = markup.match(
    new RegExp(
      `<g transform="([^"]+)" clip-path="url\\(#([^)]+)\\)">(<g ${attr}="${dataA}"[^>]*>)([\\s\\S]*?)</g></g>`,
    ),
  );
  if (!match) throw new Error(`找不到 ${dataA} 液体层（应该是：<g transform clip-path><g ${attr}>…）`);
  return { transform: match[1], clip: match[2], open: match[3], inner: match[4] };
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function firstTag(inner: string, name: string): Record<string, string> {
  const match = inner.match(new RegExp(`<${name}\\b[^>]*>`));
  if (!match) throw new Error(`液体层里没有 <${name}>`);
  return attrs(match[0]);
}

function translateYs(frames: Keyframe[]): number[] {
  return frames.map((frame) => {
    const m = String(frame.transform ?? "").match(/translateY\((-?[\d.]+)px\)/);
    return m ? Number(m[1]) : Number.NaN;
  });
}

const bodyTransformOf = (a: VesselAnchor) => `translate(${a.x} ${a.y}) scale(${a.scale})`;

/** 液体矩形/液面椭圆的「局部坐标 → 台面绝对坐标」换算是否还是原来的位置。 */
function expectSamePlaceOnBench(a: VesselAnchor, inner: string) {
  const box = liquidBox(a.kind);
  const rect = firstTag(inner, "rect");
  const scale = a.scale;
  const x = Number(rect.x);
  const y = Number(rect.y);
  const w = Number(rect.width);
  const h = Number(rect.height);
  // 横向：铺满器皿自己的液面宽度 + 左右各出壁 6 单位（多出来的交给器身裁掉）
  expect(x).toBeCloseTo(box.x - 6, 1);
  expect(w).toBeCloseTo(box.w + 12, 1);
  // 纵向：满液位上沿 = 锚点液面，底沿仍然是器底下方 6（换成台面单位核对，别被 scale 骗了）
  expect(y * scale + a.y).toBeCloseTo(a.surfaceY, 1);
  expect((y + h) * scale + a.y).toBeCloseTo(a.baseY + 6, 1);
}

const KINDS = ["volumetric", "flask", "beaker"] as const;

describe("液体层被器身裁住（clipPath 局部坐标 + 外层变换）", () => {
  it("clipPath 里只剩 d：没有把 transform 写在子 path 上", () => {
    for (const kind of KINDS) {
      const a = anchor(kind);
      const scenes = [
        html(buildRinse(a, { variant: "wash", clipId: `c-w-${kind}` })),
        html(buildRinse(a, { variant: "dilute", clipId: `c-d-${kind}` })),
        html(buildStir(a, { clipId: `c-s-${kind}` })),
        html(buildDrops(a, { clipId: `c-p-${kind}` })),
        html(buildIncident(a, { fx: "glassBreak", op: "poke", clipId: `c-i-${kind}`, baseLevel: 0.38 })),
        html(buildIncident(a, { fx: "explosion", op: "heat", clipId: `c-x-${kind}`, baseLevel: 0.38 })),
      ];
      for (const markup of scenes) {
        const clip = clipInner(markup, markup.match(/<clipPath id="([^"]+)"/)?.[1] ?? "");
        expect(clip, kind).toContain("<path d=");
        expect(clip, kind).not.toContain("transform");
      }
    }
  });

  it("洗涤 / 搅拌 / 滴加：液体层在 translate+scale 的外层里，坐标换算回原位", () => {
    for (const kind of KINDS) {
      const a = anchor(kind);
      const cases = [
        buildRinse(a, { variant: "wash", clipId: "cw" }),
        buildRinse(a, { variant: "dilute", clipId: "cd" }),
        buildStir(a, { clipId: "cs" }),
        buildDrops(a, { clipId: "cp" }),
      ];
      for (const scene of cases) {
        const block = liquidBlock(html(scene), "water");
        expect(block.transform, kind).toBe(bodyTransformOf(a));
        // 裁剪挂在不动的外层；会动的那层不许自己带裁剪（带了就会跟着液体挪）
        expect(block.clip, kind).toBeTruthy();
        expect(block.open, kind).not.toContain("clip-path");
        expectSamePlaceOnBench(a, block.inner);
        // 液面椭圆的圆心/半径也必须是局部坐标（洗涤/搅拌才有）
        const ellipse = block.inner.match(/<ellipse\b[^>]*>/);
        if (ellipse) {
          const e = attrs(ellipse[0]);
          expect(Number(e.cx) * a.scale + a.x).toBeCloseTo(a.mouthX, 1);
          expect(Number(e.cy) * a.scale + a.y).toBeCloseTo(a.surfaceY, 1);
          expect(Number(e.rx) * a.scale).toBeCloseTo(a.rx, 1);
          expect(Number(e["stroke-width"]) * a.scale).toBeCloseTo(1.2, 1);
        }
      }
    }
  });

  it("转移：源/目标两台器皿各有一个器身变换，液体都没跑出瓶外", () => {
    const from = anchor("volumetric");
    const to = anchor("beaker");
    const scene = buildTransfer(from, to, { clipFrom: "cf", clipTo: "ct" });
    const markup = html(scene);

    const fromBlock = liquidBlock(markup, "from");
    expect(fromBlock.transform).toBe(bodyTransformOf(from));
    expect(fromBlock.clip).toBe("cf");
    expect(fromBlock.open).not.toContain("clip-path");
    expectSamePlaceOnBench(from, fromBlock.inner);

    const toBlock = liquidBlock(markup, "to");
    expect(toBlock.transform).toBe(bodyTransformOf(to));
    expect(toBlock.clip).toBe("ct");
    expect(toBlock.open).not.toContain("clip-path");
    expectSamePlaceOnBench(to, toBlock.inner);

    expect(clipInner(markup, "cf")).not.toContain("transform");
    expect(clipInner(markup, "ct")).not.toContain("transform");
  });

  it("液位位移按局部单位走（÷ scale），动画才对得上液面", () => {
    const a = anchor("volumetric");
    const scene = buildRinse(a, { variant: "wash", clipId: "cw", levelStart: 0 });
    const waterBeats = scene.beats.filter((item) => item.sel === '[data-a="water"]');
    expect(waterBeats.length).toBeGreaterThanOrEqual(2); // 先涨水、再倒空
    const shifts = waterBeats.flatMap((beat) => translateYs(beat.frames));
    // 空（level 0）= 整段液柱压到器底；涨到 0.62 只压 1 - 0.62
    expect(shifts[0]).toBeCloseTo(levelShift(a, 0) / a.scale, 2);
    expect(Math.min(...shifts)).toBeCloseTo(levelShift(a, 0.62) / a.scale, 2);
    // 首帧 = 末帧（洗涤最后倒空，回到底部），中间真的涨过
    expect(shifts[0]).toBe(shifts[shifts.length - 1]);
    expect(new Set(shifts).size).toBeGreaterThan(1);
    // 换算成台面单位后仍是同一段液位（不是被 scale 缩小的大位移）
    for (const shift of shifts) expect(shift * a.scale).toBeLessThanOrEqual(levelShift(a, 0) + 0.01);
  });

  it("转移的液位方向：源液面下降、目标液面上升（局部单位）", () => {
    const from = anchor("volumetric");
    const to = anchor("beaker");
    const scene = buildTransfer(from, to, { clipFrom: "cf", clipTo: "ct" });
    const fromBeat = scene.beats.find((item) => item.sel === '[data-a="from"]');
    const toBeat = scene.beats.find((item) => item.sel === '[data-a="to"]');
    const fromShifts = translateYs(fromBeat?.frames ?? []);
    const toShifts = translateYs(toBeat?.frames ?? []);

    // 往下压得越多 = 液面越低
    expect(fromShifts[fromShifts.length - 1]).toBeGreaterThan(fromShifts[0]);
    expect(fromShifts[0]).toBeCloseTo(levelShift(from, 0.72) / from.scale, 2);
    expect(fromShifts[fromShifts.length - 1]).toBeCloseTo(levelShift(from, 0.28) / from.scale, 2);

    expect(toShifts[toShifts.length - 1]).toBeLessThan(toShifts[0]);
    expect(toShifts[0]).toBeCloseTo(levelShift(to, 0.1) / to.scale, 2);
    expect(toShifts[toShifts.length - 1]).toBeCloseTo(levelShift(to, 0.66) / to.scale, 2);
  });

  it("搅拌的静态液位也是局部单位（inline translateY）", () => {
    const a = anchor("flask");
    const markup = html(buildStir(a, { clipId: "cs", levelStart: 0.5 }));
    const block = liquidBlock(markup, "water");
    const m = String(attrs(block.open).style ?? "").match(/translateY\((-?[\d.]+)px\)/);
    expect(m).toBeTruthy();
    expect(Number(m?.[1])).toBeCloseTo(levelShift(a, 0.5) / a.scale, 2);
  });

  it("事故演出：裁剪挂在不动的外层，液面涨到 surge 时瓶身轮廓不会跟着挪", () => {
    const OPS: readonly IncidentOp[] = ["pour", "heat", "stir", "poke"];
    for (const kind of KINDS) {
      const a = anchor(kind);
      for (const op of OPS) {
        const clipId = `c-inc-${kind}`;
        const scene = buildIncident(a, {
          fx: op === "heat" ? "explosion" : "glassBreak",
          op,
          clipId,
          baseLevel: 0.38,
        });
        const block = liquidBlock(html(scene), "liquid", "data-i");

        // 裁剪在不动的外层（器身变换），会动的那层不许自己带裁剪 —— 带了裁剪就跟着液体挪
        expect(block.transform, `${kind} ${op}`).toBe(bodyTransformOf(a));
        expect(block.clip, `${kind} ${op}`).toBe(clipId);
        expect(block.open, `${kind} ${op}`).not.toContain("clip-path");

        // 横向用器皿自己的液面宽度，纵向换算回台面仍是原来的液面/器底
        expectSamePlaceOnBench(a, block.inner);

        // 液面椭圆也是局部坐标：暴沸/喷溅时它跟着瓶身走
        const ellipse = attrs(block.inner.match(/<ellipse\b[^>]*>/)?.[0] ?? "");
        expect(Number(ellipse.cx) * a.scale + a.x, `${kind} ${op}`).toBeCloseTo(a.mouthX, 1);
        expect(Number(ellipse.cy) * a.scale + a.y, `${kind} ${op}`).toBeCloseTo(a.surfaceY, 1);

        // 静态液位 = base（局部单位）；整条时间线的位移也都是局部单位
        const inline = String(attrs(block.open).style ?? "").match(/translateY\((-?[\d.]+)px\)/);
        expect(inline, `${kind} ${op}`).toBeTruthy();
        // 源码里的位移取两位小数（toFixed(2)），这里按同一精度比
        expect(Number(inline?.[1]), `${kind} ${op}`).toBeCloseTo(
          Number((levelShift(a, 0.38) / a.scale).toFixed(2)),
          2,
        );

        const liquid = scene.beats.find((beat) => beat.sel === '[data-i="liquid"]');
        const shifts = translateYs(liquid?.frames ?? []);
        expect(shifts.length, `${kind} ${op}`).toBeGreaterThan(1);
        for (const shift of shifts) {
          expect(Number.isFinite(shift), `${kind} ${op}`).toBe(true);
          // 往下压 = 液面下降，最多压到器底（空）
          expect(shift, `${kind} ${op}`).toBeGreaterThanOrEqual(-0.01);
          expect(shift * a.scale, `${kind} ${op}`).toBeLessThanOrEqual(levelShift(a, 0) + 0.01);
        }
        // 首帧 = 末帧：事故演完回到原液位，卸层不跳
        expect(shifts[0], `${kind} ${op}`).toBe(shifts[shifts.length - 1]);
      }
    }
  });
});
