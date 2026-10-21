import { describe, expect, it } from "vitest";
import {
  RADAR_DIMENSIONS,
  averageRadarSeries,
  clampPercent,
  radarSeriesFromCompetency,
  restrictRadarToRecordedCodes,
} from "./radar-data";

const codes = RADAR_DIMENSIONS.map((dim) => dim.code);

describe("clampPercent", () => {
  it("夹到 0~100，非数值按 0", () => {
    expect(clampPercent(42)).toBe(42);
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampPercent(undefined)).toBe(0);
  });
});

describe("radarSeriesFromCompetency", () => {
  it("无数据：五维全 0 且 hasData=false（不画假图）", () => {
    const series = radarSeriesFromCompetency({});
    expect(series.hasData).toBe(false);
    expect(series.sampleCount).toBe(0);
    expect(series.dims.map((dim) => dim.value)).toEqual([0, 0, 0, 0, 0]);
    expect(series.dims.every((dim) => dim.hasData === false)).toBe(true);
    expect(series.dims.map((dim) => dim.code)).toEqual(codes);
  });

  it("null / undefined 输入等同无数据，不抛错", () => {
    expect(radarSeriesFromCompetency(null).hasData).toBe(false);
    expect(radarSeriesFromCompetency(undefined).dims).toHaveLength(5);
  });

  it("单条记录：有值维度取原值，缺维补 0 并标 hasData=false", () => {
    const series = radarSeriesFromCompetency({ K1: 80, S1: 60.4, A1: 0 }, 3);
    const byCode = Object.fromEntries(series.dims.map((dim) => [dim.code, dim]));
    expect(byCode.K1).toMatchObject({ value: 80, hasData: true });
    expect(byCode.S1?.value).toBeCloseTo(60.4, 5);
    expect(byCode.A1).toMatchObject({ value: 0, hasData: true });
    expect(byCode.K2).toMatchObject({ value: 0, hasData: false });
    expect(byCode.S2).toMatchObject({ value: 0, hasData: false });
    expect(series.hasData).toBe(true);
    expect(series.sampleCount).toBe(3);
  });

  it("超范围值被夹紧（101 → 100，-1 → 0）", () => {
    const series = radarSeriesFromCompetency({ K1: 101, K2: -1 });
    const byCode = Object.fromEntries(series.dims.map((dim) => [dim.code, dim]));
    expect(byCode.K1?.value).toBe(100);
    expect(byCode.K2?.value).toBe(0);
  });
});

describe("averageRadarSeries", () => {
  it("无样本：hasData=false、sampleCount=0", () => {
    const series = averageRadarSeries([]);
    expect(series.hasData).toBe(false);
    expect(series.sampleCount).toBe(0);
    expect(series.dims.every((dim) => dim.hasData === false)).toBe(true);
  });

  it("单条样本等价于该条记录", () => {
    const series = averageRadarSeries([{ K1: 70, S1: 50 }]);
    const byCode = Object.fromEntries(series.dims.map((dim) => [dim.code, dim]));
    expect(byCode.K1?.value).toBe(70);
    expect(byCode.S1?.value).toBe(50);
    expect(series.sampleCount).toBe(1);
    expect(series.hasData).toBe(true);
  });

  it("多条平均：每维只除以有该维记录的样本（缺维不进分母）", () => {
    // K1: (80 + 60) / 2 = 70；K2: 只有第一条有记录 → 40 / 1 = 40
    const series = averageRadarSeries([{ K1: 80, K2: 40 }, { K1: 60, S1: 30 }]);
    const byCode = Object.fromEntries(series.dims.map((dim) => [dim.code, dim]));
    expect(byCode.K1).toMatchObject({ value: 70, hasData: true });
    expect(byCode.K2).toMatchObject({ value: 40, hasData: true });
    expect(byCode.S1).toMatchObject({ value: 30, hasData: true });
    expect(byCode.A1).toMatchObject({ value: 0, hasData: false });
    expect(series.sampleCount).toBe(2);
  });

  it("缺维补 0 但不误判：所有样本都没有 A1 时 A1=0 且 hasData=false", () => {
    const series = averageRadarSeries([{ K1: 88 }, { K1: 92 }]);
    const a1 = series.dims.find((dim) => dim.code === "A1");
    expect(a1).toEqual({ code: "A1", category: "素养", value: 0, hasData: false });
    expect(series.hasData).toBe(true);
  });

  it("脏样本（NaN / 缺键）不影响均值", () => {
    const series = averageRadarSeries([{ K1: Number.NaN }, { K1: 60 }, {}]);
    const byCode = Object.fromEntries(series.dims.map((dim) => [dim.code, dim]));
    expect(byCode.K1).toMatchObject({ value: 60, hasData: true });
    expect(series.sampleCount).toBe(3);
  });
});

describe("restrictRadarToRecordedCodes", () => {
  it("占位 0 被识别为「暂无数据」：只有真实记录过的码保留数据", () => {
    // data-api 会把定义里的码补 0 占位，这里 K2/S1 其实没有记录
    const base = radarSeriesFromCompetency({ K1: 80, K2: 0, A1: 0, S1: 0, S2: 90 }, 2);
    const series = restrictRadarToRecordedCodes(base, new Set(["K1", "A1", "S2"]));
    const byCode = Object.fromEntries(series.dims.map((dim) => [dim.code, dim]));
    expect(byCode.K1).toMatchObject({ value: 80, hasData: true });
    expect(byCode.A1).toMatchObject({ value: 0, hasData: true });
    expect(byCode.S2).toMatchObject({ value: 90, hasData: true });
    expect(byCode.K2).toMatchObject({ value: 0, hasData: false });
    expect(byCode.S1).toMatchObject({ value: 0, hasData: false });
    expect(series.hasData).toBe(true);
    expect(series.sampleCount).toBe(2);
  });

  it("记录集合为空 → 整体退化为无数据空态", () => {
    const base = radarSeriesFromCompetency({ K1: 0, K2: 0, A1: 0, S1: 0, S2: 0 }, 1);
    const series = restrictRadarToRecordedCodes(base, new Set());
    expect(series.hasData).toBe(false);
    expect(series.dims.every((dim) => !dim.hasData && dim.value === 0)).toBe(true);
  });

  it("不在记录集合里的非零值也会被清零（防上游口径漂移）", () => {
    const base = radarSeriesFromCompetency({ K1: 55 }, 1);
    const series = restrictRadarToRecordedCodes(base, new Set());
    expect(series.dims.find((dim) => dim.code === "K1")).toEqual({
      code: "K1",
      category: "知识",
      value: 0,
      hasData: false,
    });
  });
});
