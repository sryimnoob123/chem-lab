/**
 * 液位几何（drag-pour 画法的坐标层）：纯函数，直接单测。
 * 「液面随倒液上升」全靠这三个函数，画错一处整条动画就跳。
 */

import { describe, expect, it } from "vitest";
import { levelTopY, liquidBox, mouthOf, surfaceRxAt, defaultLevel, MOUTH_Y, CENTER_X } from "./vessel-geometry";

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
