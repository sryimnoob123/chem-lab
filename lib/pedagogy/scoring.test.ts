import { describe, expect, it } from "vitest";

import type { HintUsage } from "./hints";
import {
  ACCIDENT_MIN_LEVEL,
  REPORT_WEIGHT_CALCULATION,
  REPORT_WEIGHT_DATA,
  REPORT_WEIGHT_ERROR,
  REPORT_WEIGHT_SAFETY,
  WEIGHT_OPERATION,
  WEIGHT_PREVIEW,
  WEIGHT_REPORT,
  computeCourseResult,
  computeIndependentDeduct,
  computeObjectiveAttainment,
  computeOperationScore,
  computeReportScore,
  computeWeightedTotal,
  countAccidents,
  sumDeductions,
  type CourseResultInput,
} from "./scoring";

/**
 * exp09 的一组假数据，可手工核对：
 * - 操作分 = 100 - (3 + 3) - 5 - 2 = 87
 * - 报告分 = 100*0.3 + 90*0.3 + 85*0.2 + 95*0.2 = 30 + 27 + 17 + 19 = 93
 * - 折算总分 = 100*0.1 + 87*0.4 + 93*0.5 = 10 + 34.8 + 46.5 = 91.3
 * - 目标1 = (100 + 80) / 2 = 90（%）→ 0.9
 * - 目标2 = (87/100 + (0.5 + 1)/2) / 2 = (0.87 + 0.75) / 2 = 0.81
 * - 目标3 = 1 - 1 次 L2 事故 / 10 次尝试 = 0.9
 */
const EXP09_CASE: CourseResultInput = {
  preview: 100,
  postTest: 80,
  violations: [
    // 步6（index 5）加 5~6 滴酚酞，L1 -3
    { ruleId: "S005", competency: "S2", deduct: 3, stepIndex: 5 },
    // 步7（index 6）成线流滴定，L1 -3
    { ruleId: "S005", competency: "S2", deduct: 3, stepIndex: 6 },
  ],
  incidents: [
    // 步4（index 3）尖嘴气泡未排尽，L2 -5
    { incidentId: "exp09-H6", level: "L2", deduct: 5, terminate: false, competency: "S1", stepIndex: 3 },
  ],
  hints: [
    // 步3 洗涤：第 3 次错 → H2，扣 1
    { level: 2, competency: "S1", stepIndex: 2 },
    // 步6 滴定：第 4 次错 → H3，扣 1
    { level: 3, competency: "S2", stepIndex: 5 },
  ],
  report: { dataCompleteness: 100, calculation: 90, errorAnalysis: 85, safetyReview: 95 },
  // S1 = (4 - 1.5)/5 = 0.5；S2 = 3/3 = 1
  skillMasteries: [0.5, 1],
  attemptCount: 10,
};

function hintsOf(levels: readonly HintUsage["level"][]): HintUsage[] {
  return levels.map((level, index) => ({ level, competency: "S1", stepIndex: index }));
}

describe("scoring · 操作分聚合", () => {
  it("无违规、无事故、无提示时操作分为 100", () => {
    const result = computeOperationScore({ violations: [], incidents: [] });
    expect(result.score).toBe(100);
    expect(result.terminated).toBe(false);
    expect(result.rawScore).toBe(100);
  });

  it("违规扣分逐条累加", () => {
    const result = computeOperationScore({
      violations: [
        { ruleId: "S005", competency: "S2", deduct: 5 },
        { ruleId: "S007", competency: "S2", deduct: 5 },
      ],
      incidents: [],
    });
    expect(result.violationDeduct).toBe(10);
    expect(result.score).toBe(90);
  });

  it("提示扣分只统计 H2 及以上，且 H4 也计 1 次", () => {
    expect(computeIndependentDeduct(hintsOf([0, 1]))).toBe(0);
    expect(computeIndependentDeduct(hintsOf([0, 1, 2]))).toBe(1);
    expect(computeIndependentDeduct(hintsOf([2, 2, 3, 4]))).toBe(4);
  });

  it("H2 提示扣分计入操作分", () => {
    const result = computeOperationScore({
      violations: [],
      incidents: [],
      hints: hintsOf([0, 2, 3]),
    });
    expect(result.independentDeduct).toBe(2);
    expect(result.score).toBe(98);
  });

  it("扣分超过 100 时操作分 clamp 到 0，原始值保留负数", () => {
    const result = computeOperationScore({
      violations: [{ ruleId: "S001", competency: "A1", deduct: 120 }],
      incidents: [],
    });
    expect(result.score).toBe(0);
    expect(result.rawScore).toBe(-20);
  });

  it("L4 事故终止实验：无论其他扣分多少，操作分记 0", () => {
    const result = computeOperationScore({
      violations: [],
      incidents: [
        { incidentId: "exp09-H1", level: "L4", deduct: 20, terminate: true },
      ],
    });
    expect(result.terminated).toBe(true);
    expect(result.score).toBe(0);
  });

  it("sumDeductions 忽略 NaN，不让它污染总分", () => {
    expect(sumDeductions([{ deduct: 5 }, { deduct: Number.NaN }, { deduct: 2 }])).toBe(7);
  });
});

describe("scoring · 三项折算", () => {
  it("权重之和为 100%（1.0）", () => {
    const weightsSum = WEIGHT_PREVIEW + WEIGHT_OPERATION + WEIGHT_REPORT;
    expect(weightsSum).toBeCloseTo(1, 12);
    expect(
      REPORT_WEIGHT_DATA + REPORT_WEIGHT_CALCULATION + REPORT_WEIGHT_ERROR + REPORT_WEIGHT_SAFETY,
    ).toBeCloseTo(1, 12);
  });

  it("三项全 100 时总分为 100，贡献分别为 10/40/50", () => {
    const total = computeWeightedTotal({ preview: 100, operation: 100, report: 100 });
    expect(total.preview).toBe(10);
    expect(total.operation).toBe(40);
    expect(total.report).toBe(50);
    expect(total.total).toBe(100);
    expect(total.weightsSum).toBeCloseTo(1, 12);
  });

  it("exp09 假数据折算总分 = 91.3", () => {
    const total = computeWeightedTotal({ preview: EXP09_CASE.preview, operation: 87, report: 93 });
    expect(total.preview).toBe(10);
    expect(total.operation).toBeCloseTo(34.8, 12);
    expect(total.report).toBeCloseTo(46.5, 12);
    expect(total.total).toBeCloseTo(91.3, 12);
    expect(total.preview + total.operation + total.report).toBeCloseTo(total.total, 12);
  });

  it("分项超出 0~100 时先 clamp 再折算", () => {
    const total = computeWeightedTotal({ preview: 120, operation: -10, report: 100 });
    expect(total.total).toBeCloseTo(10 + 0 + 50, 12);
  });
});

describe("scoring · 报告分", () => {
  it("按 30/30/20/20 加权，exp09 假数据 = 93", () => {
    expect(computeReportScore(EXP09_CASE.report)).toBeCloseTo(93, 12);
  });

  it("四部分全 100 得 100，全 0 得 0", () => {
    expect(
      computeReportScore({
        dataCompleteness: 100,
        calculation: 100,
        errorAnalysis: 100,
        safetyReview: 100,
      }),
    ).toBe(100);
    expect(
      computeReportScore({
        dataCompleteness: 0,
        calculation: 0,
        errorAnalysis: 0,
        safetyReview: 0,
      }),
    ).toBe(0);
  });

  it("报告分 clamp 在 0~100", () => {
    expect(
      computeReportScore({
        dataCompleteness: 150,
        calculation: 150,
        errorAnalysis: 150,
        safetyReview: 150,
      }),
    ).toBe(100);
  });
});

describe("scoring · 课程目标达成度", () => {
  it("事故率只统计 L2 及以上，L1 只是提示", () => {
    expect(countAccidents([])).toBe(0);
    expect(countAccidents([{ level: "L1" }])).toBe(0);
    expect(countAccidents([{ level: "L1" }, { level: "L2" }, { level: "L4" }])).toBe(2);
    expect(ACCIDENT_MIN_LEVEL).toBe("L2");
  });

  it("exp09 假数据：目标 1/2/3 = 0.9 / 0.81 / 0.9", () => {
    const objectives = computeObjectiveAttainment({
      preTest: EXP09_CASE.preview,
      postTest: EXP09_CASE.postTest,
      operationScore: 87,
      skillMasteries: EXP09_CASE.skillMasteries,
      incidents: EXP09_CASE.incidents,
      attemptCount: EXP09_CASE.attemptCount,
    });
    expect(objectives.objective1).toBeCloseTo(0.9, 12);
    expect(objectives.objective2).toBeCloseTo(0.81, 12);
    expect(objectives.objective3).toBeCloseTo(0.9, 12);
  });

  it("目标 3 在事故率 > 100% 时 clamp 到 0", () => {
    const objectives = computeObjectiveAttainment({
      preTest: 0,
      postTest: 0,
      operationScore: 0,
      skillMasteries: [],
      incidents: [
        { level: "L4" },
        { level: "L4" },
        { level: "L4" },
        { level: "L4" },
        { level: "L4" },
      ],
      attemptCount: 1,
    });
    expect(objectives.objective3).toBe(0);
  });

  it("没有技能能力点时目标 2 退化为操作分本身", () => {
    const objectives = computeObjectiveAttainment({
      preTest: 100,
      postTest: 100,
      operationScore: 80,
      skillMasteries: [],
      incidents: [],
      attemptCount: 0,
    });
    expect(objectives.objective2).toBeCloseTo(0.8, 12);
    expect(objectives.objective1).toBe(1);
    expect(objectives.objective3).toBe(1);
  });
});

describe("scoring · exp09 端到端结算", () => {
  it("操作分、报告分、折算总分与目标达成度全部可核对", () => {
    const result = computeCourseResult(EXP09_CASE);
    expect(result.operation.score).toBe(87);
    expect(result.operation.violationDeduct).toBe(6);
    expect(result.operation.incidentDeduct).toBe(5);
    expect(result.operation.independentDeduct).toBe(2);
    expect(result.operation.terminated).toBe(false);
    expect(result.reportScore).toBeCloseTo(93, 12);
    expect(result.threePart).toEqual({ preview: 100, operation: 87, report: result.reportScore });
    expect(result.weighted.total).toBeCloseTo(91.3, 12);
    expect(result.objectives.objective1).toBeCloseTo(0.9, 12);
    expect(result.objectives.objective2).toBeCloseTo(0.81, 12);
    expect(result.objectives.objective3).toBeCloseTo(0.9, 12);
  });

  it("L4 触发时三项中的操作分归零，总分只由预习与报告构成", () => {
    const result = computeCourseResult({
      preview: 100,
      postTest: 100,
      violations: [],
      incidents: [
        { incidentId: "exp09-H1", level: "L4", deduct: 20, terminate: true },
      ],
      report: { dataCompleteness: 100, calculation: 100, errorAnalysis: 100, safetyReview: 100 },
      skillMasteries: [1],
      attemptCount: 1,
    });
    expect(result.operation.score).toBe(0);
    expect(result.weighted.total).toBeCloseTo(10 + 0 + 50, 12);
    expect(result.objectives.objective3).toBe(0);
  });
});
