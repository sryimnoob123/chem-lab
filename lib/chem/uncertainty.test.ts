import { describe, expect, it } from "vitest";
import {
  READING_SPECS,
  SIG_FIG_FAQ,
  addSub,
  countSigFigs,
  decimalsOf,
  formatPercent,
  formatSigFigs,
  getSigFigFaq,
  minSampleMass,
  multiplyDivide,
  multiplyDivideByRule,
  readingSpec,
  recordReading,
  relativeError,
  relativeMeanDeviation,
  relativeRange,
  roundHalfEven,
  roundToSigFigs,
} from "./uncertainty";

describe("读数位数", () => {
  it("滴定管 0.01 mL / 天平 0.0001 g / pH 0.01 的记录位数正确", () => {
    expect(readingSpec("acidBurette").decimals).toBe(2);
    expect(readingSpec("alkaliBurette").decimals).toBe(2);
    expect(readingSpec("analyticalBalance").decimals).toBe(4);
    expect(readingSpec("phMeter").decimals).toBe(2);
    expect(readingSpec("pipette25").decimals).toBe(2);
    expect(readingSpec("cylinder100").decimals).toBe(1);
    expect(() => readingSpec("missing")).toThrow(/未知仪器/);
  });

  it("recordReading 修约并补足位数", () => {
    expect(recordReading("acidBurette", 24.846).display).toBe("24.85");
    expect(recordReading("analyticalBalance", 1.0599).display).toBe("1.0599");
    expect(recordReading("phMeter", 4.0).display).toBe("4.00");
    expect(recordReading("pipette25", 25).display).toBe("25.00");
  });

  it("仪器规则表本身完整性：单位/分度/估读位/ref 齐全", () => {
    expect(READING_SPECS.length).toBeGreaterThanOrEqual(12);
    for (const spec of READING_SPECS) {
      expect(spec.smallestDivision).toBeGreaterThan(0);
      expect(spec.estimatedTo).toBeGreaterThan(0);
      expect(spec.estimatedTo).toBeLessThanOrEqual(spec.smallestDivision);
      expect(spec.ref.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("有效数字计数", () => {
  it("字符串保留末尾 0，数字按最短表示", () => {
    expect(countSigFigs("0.1")).toBe(1);
    expect(countSigFigs("0.10")).toBe(2);
    expect(countSigFigs("25.00")).toBe(4);
    expect(countSigFigs("500")).toBe(3);
    expect(countSigFigs("1.0599")).toBe(5);
    expect(countSigFigs("1.50e-3")).toBe(3);
    expect(countSigFigs(0)).toBe(1);
    expect(decimalsOf("25.00")).toBe(2);
    expect(decimalsOf("1.5e-3")).toBe(4);
  });
});

describe("加减法", () => {
  it("23.10 − 0.02 = 23.08，保留两位小数", () => {
    const r = addSub(["23.10", "-0.02"]);
    expect(r.decimals).toBe(2);
    expect(r.value).toBeCloseTo(23.08, 10);
    expect(r.display).toBe("23.08");
  });

  it("差减法称量 13.4055 − 12.3456 = 1.0599，保留四位小数", () => {
    const r = addSub(["13.4055", "-12.3456"]);
    expect(r.decimals).toBe(4);
    expect(r.value).toBeCloseTo(1.0599, 10);
    expect(r.display).toBe("1.0599");
  });
});

describe("乘除法", () => {
  it("0.1000 mol/L × 24.80 mL = 2.480（4 位）", () => {
    const r = multiplyDivide(["0.1000", "24.80"]);
    expect(r.significantFigures).toBe(4);
    expect(r.value).toBeCloseTo(2.48, 10);
    expect(r.display).toBe("2.480");
  });

  it("0.2000 × 19.60 ÷ 20.00 = 0.1960（4 位）", () => {
    const r = multiplyDivide(["0.2000", "19.60"], { divideBy: ["20.00"] });
    expect(r.significantFigures).toBe(4);
    expect(r.value).toBeCloseTo(0.196, 10);
    expect(r.display).toBe("0.1960");
  });

  it("严格按字面位数：0.1 × 25.00 只取 1 位（2 mmol，五成双）", () => {
    const r = multiplyDivide(["0.1", "25.00"]);
    expect(r.significantFigures).toBe(1);
    expect(r.display).toBe("2");
  });

  it("平台口径：标称浓度按 3 位 → 0.1 mol/L × 25.00 mL = 2.50 mmol", () => {
    const r = multiplyDivideByRule([
      { value: "0.1", kind: "nominal-concentration", label: "c" },
      { value: "25.00", label: "V" },
    ]);
    expect(r.significantFigures).toBe(3);
    expect(r.value).toBeCloseTo(2.5, 10);
    expect(r.display).toBe("2.50");
    expect(r.rule).toContain("标称浓度");
  });
});

describe("修约（四舍六入五成双）", () => {
  it("0.5 进位规则边界：末位为偶舍、为奇进", () => {
    expect(roundHalfEven(0.5, 0)).toBe(0);
    expect(roundHalfEven(1.5, 0)).toBe(2);
    expect(roundHalfEven(2.5, 0)).toBe(2);
    expect(roundHalfEven(3.5, 0)).toBe(4);
    expect(roundHalfEven(0.125, 2)).toBeCloseTo(0.12, 10);
    expect(roundHalfEven(0.375, 2)).toBeCloseTo(0.38, 10);
    expect(roundHalfEven(1.25, 1)).toBeCloseTo(1.2, 10);
  });

  it("五后非零则进一；负数对称", () => {
    expect(roundHalfEven(2.51, 0)).toBe(3);
    expect(roundHalfEven(-2.5, 0)).toBe(-2);
    expect(roundHalfEven(-3.5, 0)).toBe(-4);
  });

  it("按有效数字修约与显示", () => {
    expect(roundToSigFigs(0.1008, 3)).toBeCloseTo(0.101, 10);
    expect(formatSigFigs(0.1008, 3)).toBe("0.101");
    expect(formatSigFigs(0.15, 4)).toBe("0.1500");
  });
});

describe("误差指标", () => {
  it("相对误差：0.09991 对 0.1000 约 0.09%", () => {
    expect(relativeError(0.09991, 0.1)).toBeCloseTo(0.09, 6);
    expect(relativeError(0.196, 0.2)).toBeCloseTo(2, 10);
  });

  it("相对极差：25.18/25.22/25.20 → 0.16%", () => {
    expect(relativeRange([25.18, 25.22, 25.2])).toBeCloseTo(0.15873, 4);
    expect(formatPercent(relativeRange([25.18, 25.22, 25.2]), 2)).toBe("0.16%");
  });

  it("相对平均偏差：1/2/3 平均 2，偏差 33.33%", () => {
    expect(relativeMeanDeviation([1, 2, 3])).toBeCloseTo(33.3333, 3);
  });

  it("最小称样量：感量 0.0001 g、允许误差 0.1% → 0.2 g", () => {
    expect(minSampleMass(0.0001, 0.1)).toBeCloseTo(0.2, 10);
  });
});

describe("问答口径与非法输入", () => {
  it("题目示例在 FAQ 里答案明确为 3 位", () => {
    const item = getSigFigFaq("nominal-concentration-times-volume");
    expect(item).toBeDefined();
    expect(item?.answerSigFigs).toBe(3);
    expect(item?.answerDisplay).toBe("2.50 mmol");
    expect(SIG_FIG_FAQ.length).toBeGreaterThanOrEqual(3);
    expect(getSigFigFaq("strict-literal-digits")?.answerSigFigs).toBe(1);
  });

  it("非法输入直接抛错，不返回垃圾结果", () => {
    expect(() => countSigFigs("abc")).toThrow(TypeError);
    expect(() => relativeError(1, 0)).toThrow(RangeError);
    expect(() => relativeRange([1])).toThrow(RangeError);
    expect(() => roundToSigFigs(1, 0)).toThrow(TypeError);
    expect(() => addSub([])).toThrow(TypeError);
  });
});
