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
  bodyBox,
  levelTopY,
  liquidBox,
  mouthOf,
  mouthRimArc,
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

