/**
 * 液位几何（drag-pour 画法的坐标层）：纯函数，直接单测。
 * 「液面随倒液上升」全靠这三个函数，画错一处整条动画就跳。
 */

import { describe, expect, it } from "vitest";
/**
 * 玻璃五层（2026-10-23 B1）：Tint / Specular rim / Sheen 用到的参考几何。
 * 这几条数值一旦偏离真实轮廓，亮边就会画到器皿外面去（fly 到墙上）——所以要有守卫。
 */

import {
  BASE_Y,
  BODY_BOX,
  SEDIMENT_MAX_H,
  bodyBox,
  levelTopY,
  liquidBox,
  mouthOf,
  mouthRimArc,
  sedimentDomeRy,
  sedimentHeight,
  sedimentPath,
  sedimentTopY,
  surfaceRimArc,
  surfaceRxAt,
  defaultLevel,
  MOUTH_Y,
  CENTER_X,
} from "./vessel-geometry";

const beaker = liquidBox("beaker");
const flask = liquidBox("flask");

describe("levelTopY：液位 → 液面上沿", () => {
  it("level 0 = 器内底（没有液体）", () => {
    expect(levelTopY(beaker, 0)).toBe(beaker.bottom);
  });

  it("level 1 = topMax（不进瓶颈）", () => {
    expect(levelTopY(beaker, 1)).toBe(beaker.topMax);
  });

  it("中间线性：0.5 正好在中点", () => {
    expect(levelTopY(beaker, 0.5)).toBeCloseTo((beaker.bottom + beaker.topMax) / 2, 1);
  });

  it("越界夹住：负数=空、>1=满", () => {
    expect(levelTopY(beaker, -3)).toBe(beaker.bottom);
    expect(levelTopY(beaker, 9)).toBe(beaker.topMax);
  });

  it("单调：液位越高 y 越小（往上涨）", () => {
    const ys = [0, 0.25, 0.5, 0.75, 1].map((level) => levelTopY(flask, level));
    for (let i = 1; i < ys.length; i += 1) expect(ys[i]).toBeLessThan(ys[i - 1]);
  });
});

describe("surfaceRxAt：液面椭圆跟着瓶身收腰", () => {
  it("锥形瓶：越往上越窄", () => {
    expect(surfaceRxAt("flask", 180)).toBeGreaterThan(surfaceRxAt("flask", 90));
    expect(surfaceRxAt("flask", 90)).toBeLessThan(47);
    expect(surfaceRxAt("flask", 180)).toBeLessThanOrEqual(47);
  });

  it("烧杯是直筒：任何液面同一半径（不会变成一个橄榄）", () => {
    expect(surfaceRxAt("beaker", 60)).toBe(surfaceRxAt("beaker", 180));
  });

  it("容量瓶瓶颈里只有一个颈宽", () => {
    expect(surfaceRxAt("volumetric", 60)).toBe(12);
    expect(surfaceRxAt("volumetric", 130)).toBeGreaterThan(30);
  });
});

describe("瓶口 / 中轴：倾倒时瓶口要对准这里", () => {
  it("瓶口 y 在器皿顶部附近，且中轴落在包围盒中线", () => {
    for (const kind of ["beaker", "flask", "volumetric", "tube"] as const) {
      const mouth = mouthOf(kind);
      expect(mouth.y).toBe(MOUTH_Y[kind]);
      expect(mouth.cx).toBe(CENTER_X[kind]);
      expect(mouth.rx).toBeGreaterThan(0);
      expect(mouth.ry).toBeGreaterThan(0);
      // 2.5D：瓶口一定是扁的（ry < rx），否则看起来是正圆开口
      expect(mouth.ry).toBeLessThan(mouth.rx);
    }
  });
});

describe("defaultLevel", () => {
  it("有液体给 0.38 的底液位，没有就空", () => {
    expect(defaultLevel(true)).toBeGreaterThan(0.3);
    expect(defaultLevel(false)).toBe(0);
  });
});

describe("玻璃五层几何（B1：Tint / Specular rim / Sheen）", () => {
  const KINDS = ["flask", "beaker", "volumetric", "tube", "dish", "burette"] as const;

  it("BODY_BOX 从瓶口盖到器底（偏了亮边就画到器皿外面去）", () => {
    for (const kind of KINDS) {
      const box = bodyBox(kind);
      expect(BODY_BOX[kind]).toEqual(box);
      expect(box.w).toBeGreaterThan(0);
      expect(box.h).toBeGreaterThan(0);
      // 顶部要盖住瓶口（否则 rim 渐变的「最亮」落不到口沿上）
      expect(box.y).toBeLessThanOrEqual(MOUTH_Y[kind] + 1);
      // 底部要盖到器底（否则器底那段没有被裁，渐变会提前淡出成一片灰）
      expect(box.y + box.h).toBeGreaterThanOrEqual(BASE_Y[kind]);
      // 中轴在框内
      expect(CENTER_X[kind]).toBeGreaterThanOrEqual(box.x);
      expect(CENTER_X[kind]).toBeLessThanOrEqual(box.x + box.w);
    }
  });

  it("BODY_BOX 落在器皿自己的画布里（Sheen 矩形按它铺，越界会在瓶外留一条光带）", () => {
    const CANVAS: Record<(typeof KINDS)[number], number> = {
      flask: 160,
      beaker: 160,
      volumetric: 160,
      tube: 40,
      dish: 160,
      burette: 120,
    };
    for (const kind of KINDS) {
      const box = bodyBox(kind);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(CANVAS[kind]);
    }
  });

  it("瓶口高光弧：只画上半圈、半径比口沿小一圈、两端落在口沿上", () => {
    for (const kind of KINDS) {
      const mouth = mouthOf(kind);
      const arc = mouthRimArc(kind);
      expect(arc.startsWith("M ")).toBe(true);
      // A rx ry 0 0 1 x y —— sweep=1 = 从左上绕到右上（上半圈）
      expect(arc).toContain(" 0 0 1 ");
      const numbers = arc.replace(/[MA]/g, " ").trim().split(/\s+/).map(Number);
      const [x0, y0, rx, ry, , , , x1, y1] = numbers;
      expect(rx).toBeLessThan(mouth.rx);
      expect(ry).toBeLessThan(mouth.ry);
      expect(rx / ry).toBeCloseTo(mouth.rx / mouth.ry, 1); // 与口沿同一压缩比
      expect(x0).toBeCloseTo(mouth.cx - rx, 1);
      expect(x1).toBeCloseTo(mouth.cx + rx, 1);
      expect(y0).toBeCloseTo(mouth.y, 2);
      expect(y1).toBeCloseTo(mouth.y, 2);
    }
  });
});

describe("液体分层（B2）：液面远端亮弧 / 器底沉淀", () => {
  const KINDS = ["flask", "beaker", "volumetric", "tube", "dish", "burette"] as const;

  it("液面亮弧：只画上半圈（sweep=1）、半径缩进到液面盘里侧、两端落在液面中线上", () => {
    for (const kind of KINDS) {
      const box = liquidBox(kind);
      const top = levelTopY(box, 0.38);
      const rx = surfaceRxAt(kind, top);
      const ry = Number((rx * 0.62).toFixed(2));
      const arc = surfaceRimArc(box.cx, top, rx, ry, 0.9);
      expect(arc).toContain(" 0 0 1 ");
      const numbers = arc.replace(/[MA]/g, " ").trim().split(/\s+/).map(Number);
      const [x0, y0, arx, ary, , , , x1, y1] = numbers;
      // 缩进 10%：亮弧压在液面盘内，不贴器壁描边（贴上去会被外描边的深墨吃掉）
      expect(arx).toBeCloseTo(rx * 0.9, 1);
      expect(ary).toBeCloseTo(ry * 0.9, 1);
      expect(x0).toBeCloseTo(box.cx - arx, 1);
      expect(x1).toBeCloseTo(box.cx + arx, 1);
      expect(y0).toBeCloseTo(top, 2);
      expect(y1).toBeCloseTo(top, 2);
    }
  });

  it("沉淀层：贴器底、有上限、液体越浅越薄", () => {
    for (const kind of KINDS) {
      const box = liquidBox(kind);
      const shallow = levelTopY(box, 0.12);
      const deep = levelTopY(box, 0.9);
      const hDeep = sedimentHeight(box, deep);
      const hShallow = sedimentHeight(box, shallow);
      // 深度 42% 收口 + 16 单位上限
      expect(hDeep).toBeLessThanOrEqual(SEDIMENT_MAX_H);
      expect(hDeep).toBeGreaterThan(3);
      expect(hShallow).toBeLessThan(hDeep);
      // 沉淀上沿必须在液面之下、器底之上（y 轴向下：堆顶 y 比液面大 = 在液面下方）
      expect(sedimentTopY(box, deep)).toBeGreaterThan(deep);
      expect(sedimentTopY(box, deep)).toBeLessThan(box.bottom);
      // 太浅（深度 < 3）不给画：返回空 path，渲染层据此跳过
      expect(sedimentHeight(box, box.bottom - 1)).toBe(0);
      expect(sedimentPath(box, box.bottom - 1)).toBe("");
    }
  });

  it("沉淀形状：起于器底、堆顶向上拱（第二个点比堆顶基线高）、左右贴到液体矩形的两边", () => {
    const box = liquidBox("beaker");
    const top = levelTopY(box, 0.38);
    const d = sedimentPath(box, top);
    // M left bottom → L left topY → A rx ry 0 0 1 right topY → L right bottom → Z
    const m = d.match(
      /^M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) A ([-\d.]+) ([-\d.]+) 0 0 1 ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) Z$/,
    );
    expect(m, `沉淀 path 形状变了：${d}`).not.toBeNull();
    const [left, bottomY, left2, topY, arx, ary, right, arcY, right2, rightBottom] = m!.slice(1).map(Number);
    expect(left).toBeCloseTo(box.x, 2);
    expect(left2).toBeCloseTo(box.x, 2);
    expect(right).toBeCloseTo(box.x + box.w, 2);
    expect(right2).toBeCloseTo(box.x + box.w, 2);
    expect(bottomY).toBeCloseTo(box.bottom, 2);
    expect(rightBottom).toBeCloseTo(box.bottom, 2);
    expect(topY).toBeCloseTo(sedimentTopY(box, top), 2);
    expect(arcY).toBeCloseTo(sedimentTopY(box, top), 2);
    expect(arx).toBeCloseTo(box.w / 2, 2);
    expect(ary).toBeCloseTo(sedimentDomeRy(box), 2);
    expect(ary).toBeGreaterThan(0); // 堆顶是弧，不是一条尺线
  });
});

