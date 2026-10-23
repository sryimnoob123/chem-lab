/**
 * 托盘安全边（fitTray）：右栏浮在台面上时，托盘右端不许钻到它底下。
 *
 * 数值来自实测（2026-10-23，dev :3000 /exp/exp01?force=1）：
 * - 视口 1152 宽：右栏左沿 904px、viewBox 缩放 1152/1560 → 换算后 safeRight ≈ 1244 单位；
 *   改前托盘 640..1290（右端在卡片底下 21px），改后 ~640..1228。
 * - 视口 1024：safeRight ≈ 1203；改后托盘右端仍 < safeRight。
 * - 视口 1440：safeRight ≈ 1320 > 满宽 1290 → 宽度一点不缩（大屏版面保持不动）。
 */
import { describe, expect, it } from "vitest";
import {
  BALANCE_ART,
  BALANCE_STROKE,
  BENCH,
  RAIL_GAP,
  balanceHitBox,
  fitTray,
  shiftInsideRight,
} from "./bench-layout";

const FULL = BENCH.tray;

describe("fitTray", () => {
  it("拿不到右栏量测时保持满宽（首帧 / 右栏不浮在台面上）", () => {
    const a = fitTray(FULL, null);
    expect(a.w).toBe(FULL.w);
    expect(a.x).toBe(FULL.x);
  });

  it("大屏（1440，safeRight ≈ 1320）不缩宽度", () => {
    const a = fitTray(FULL, 1320);
    expect(a.w).toBe(FULL.w);
    expect(a.x + a.w).toBe(FULL.x + FULL.w);
  });

  it("1152 宽收边后右端落在净空以内", () => {
    const a = fitTray(FULL, 1244);
    expect(a.x + a.w).toBeLessThanOrEqual(1244 - RAIL_GAP);
    expect(a.w).toBeLessThan(FULL.w);
    // 八件工具还得放得下：每件至少 ~56 单位
    expect(a.w / 8).toBeGreaterThanOrEqual(56);
  });

  it("1024 宽也不会挤到卡片底下，且不小于最窄宽度", () => {
    const a = fitTray(FULL, 1203);
    expect(a.x + a.w).toBeLessThanOrEqual(1203 - RAIL_GAP);
    expect(a.w).toBeGreaterThanOrEqual(480);
  });

  it("右栏左沿极端靠左时，宽度收到最窄为止（不出现负宽）", () => {
    const a = fitTray(FULL, 700);
    expect(a.w).toBe(480);
    expect(a.x).toBe(FULL.x);
  });
});

/**
 * 天平命中区（A2）：命中区必须盖满「画出来的外沿 + 描边」，且不许乱扩把旁边的点击吞掉。
 * 数值来自实测（2026-10-23，dev :3000 /exp/exp01?force=1，1440×900）：
 * 手写 132×126 时，图形左右边缘外 0.5px 采样是 MISS（描边外沿 0.8 单位在命中区外）。
 */
describe("balanceHitBox", () => {
  const half = BALANCE_STROKE / 2;

  it("四边都不许比图形小（含描边外沿）—— 这是「点最外一圈没反应」的根因", () => {
    const hit = balanceHitBox();
    expect(hit.x).toBeLessThanOrEqual(BALANCE_ART.x - half);
    expect(hit.y).toBeLessThanOrEqual(BALANCE_ART.y - half);
    expect(hit.x + hit.w).toBeGreaterThanOrEqual(BALANCE_ART.x + BALANCE_ART.w + half);
    expect(hit.y + hit.h).toBeGreaterThanOrEqual(BALANCE_ART.y + BALANCE_ART.h + half);
  });

  it("也不许乱扩：每边最多放 3 单位（再大就抢洗涤槽的点击）", () => {
    const hit = balanceHitBox();
    expect(BALANCE_ART.x - hit.x).toBeLessThanOrEqual(3);
    expect(BALANCE_ART.y - hit.y).toBeLessThanOrEqual(3);
    expect(hit.x + hit.w - (BALANCE_ART.x + BALANCE_ART.w)).toBeLessThanOrEqual(3);
    expect(hit.y + hit.h - (BALANCE_ART.y + BALANCE_ART.h)).toBeLessThanOrEqual(3);
  });

  it("要比图形大一圈（不是刚好齐边）：否则描边压边时又回到漏点", () => {
    const hit = balanceHitBox();
    expect(hit.w).toBeGreaterThan(BALANCE_ART.w);
    expect(hit.h).toBeGreaterThan(BALANCE_ART.h);
  });
});

/**
 * 器皿行左移（shiftInsideRight）：1440 不动、1024 把锥形瓶拉出来。
 * 数值来自实测（DOM）：1024 宽下锥形瓶右沿原本压在任务卡上 28px。
 */
describe("shiftInsideRight", () => {
  /* 与 exp01 台面同形（坐标抄 lib/scene/palette.ts）：烧杯在左，锥形瓶最右（右沿 1040+186=1226） */
  const ROW = [
    { id: "beaker", x: 430, w: 168 },
    { id: "flask", x: 1040, w: 186 },
  ];

  it("大屏够宽时一点不动（不无缘无故挪器具）", () => {
    const r = shiftInsideRight(ROW, 1320);
    expect(r.dx).toBe(0);
    expect(r.items.map((i) => i.x)).toEqual(ROW.map((i) => i.x));
  });

  it("量不到右栏（null）时也不动 —— 首帧 / 右栏在台面下方", () => {
    expect(shiftInsideRight(ROW, null).dx).toBe(0);
  });

  it("1024 宽（safeRight 1202）把最右那台收到净空以内，且只动 x、间距不变", () => {
    const r = shiftInsideRight(ROW, 1202);
    const right = Math.max(...r.items.map((i) => i.x + i.w));
    expect(right).toBeLessThanOrEqual(1202 - RAIL_GAP);
    expect(r.dx).toBeLessThan(0);
    // 相对间距不变 = 整行平移，不是各自乱挪
    expect(r.items[1].x - r.items[0].x).toBe(ROW[1].x - ROW[0].x);
  });

  it("内缩量留够（不是刚好卡在边上）：右沿离安全边至少 20 单位", () => {
    const r = shiftInsideRight(ROW, 1202);
    const right = Math.max(...r.items.map((i) => i.x + i.w));
    expect(1202 - RAIL_GAP - right).toBeGreaterThanOrEqual(20);
  });
});
