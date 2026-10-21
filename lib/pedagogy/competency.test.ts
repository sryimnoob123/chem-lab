import { describe, expect, it } from "vitest";

import {
  ALL_COMPETENCIES,
  buildRadarData,
  competencyCategory,
  computeMastery,
  createCompetencyLedger,
  masteryOf,
  recordOutcome,
  recordOutcomes,
  tallyCompetency,
  type CompetencyCode,
  type CompetencyEvent,
} from "./competency";

const K1: CompetencyCode = "K1";
const S1: CompetencyCode = "S1";

function ledgerOf(events: readonly CompetencyEvent[]) {
  return recordOutcomes(createCompetencyLedger(), events);
}

describe("competency · mastery 公式边界", () => {
  it("0 次尝试：分母取 max(1, 0)，mastery = 0", () => {
    expect(computeMastery(0, 0, 0)).toBe(0);
  });

  it("全对：mastery = 1", () => {
    expect(computeMastery(1, 0, 0)).toBe(1);
    expect(computeMastery(7, 0, 0)).toBe(1);
  });

  it("全错：分子为负，clamp 到 0", () => {
    expect(computeMastery(0, 1, 0)).toBe(0);
    expect(computeMastery(0, 5, 0)).toBe(0);
  });

  it("有事故：一次事故折 3 次正确", () => {
    // (3 - 1.5*0 - 3*1) / 3 = 0
    expect(computeMastery(3, 0, 1)).toBe(0);
    // (2 - 0 - 3) / 2 → 负数 clamp 0
    expect(computeMastery(2, 0, 1)).toBe(0);
  });

  it("混合数据按契约公式精确计算", () => {
    // (4 - 1.5) / 5 = 0.5
    expect(computeMastery(4, 1, 0)).toBeCloseTo(0.5, 12);
    // (6 - 1.5*2 - 3*0) / 8 = 3 / 8
    expect(computeMastery(6, 2, 0)).toBeCloseTo(0.375, 12);
    // (5 - 1.5 - 3) / 6 = 0.5 / 6
    expect(computeMastery(5, 1, 1)).toBeCloseTo(0.5 / 6, 12);
  });

  it("非法计数（NaN/负数）按 0 处理，不产生 NaN", () => {
    expect(computeMastery(Number.NaN, 1, 0)).toBe(0);
    expect(computeMastery(-3, 0, 0)).toBe(0);
    expect(Number.isNaN(computeMastery(Number.NaN, Number.NaN, Number.NaN))).toBe(false);
  });
});

describe("competency · 账本记录与聚合", () => {
  it("correct/wrong/incident 分别计数，attempts 不含事故", () => {
    const ledger = ledgerOf([
      { competency: K1, outcome: "correct" },
      { competency: K1, outcome: "correct" },
      { competency: K1, outcome: "wrong" },
      { competency: K1, outcome: "incident" },
      { competency: S1, outcome: "correct" },
    ]);
    const k1 = tallyCompetency(ledger, K1);
    expect(k1).toMatchObject({ correct: 2, wrong: 1, incidents: 1, attempts: 3 });
    // (2 - 1.5 - 3) / 3 → 负数 clamp 0
    expect(k1.mastery).toBe(0);

    const s1 = tallyCompetency(ledger, S1);
    expect(s1).toMatchObject({ correct: 1, wrong: 0, incidents: 0, attempts: 1 });
    expect(s1.mastery).toBe(1);
  });

  it("未出现的能⼒点返回 0 次尝试与 mastery 0", () => {
    const ledger = ledgerOf([{ competency: K1, outcome: "correct" }]);
    expect(tallyCompetency(ledger, "A1")).toEqual({
      code: "A1",
      correct: 0,
      wrong: 0,
      incidents: 0,
      attempts: 0,
      mastery: 0,
    });
    expect(masteryOf(ledger, "A1")).toBe(0);
  });

  it("recordOutcome 不修改原账本", () => {
    const base = createCompetencyLedger();
    const next = recordOutcome(base, { competency: S1, outcome: "correct" });
    expect(base.events).toHaveLength(0);
    expect(next.events).toHaveLength(1);
    expect(next).not.toBe(base);
  });

  it("跨能力点不串号：同一事件只影响自己的能力点", () => {
    const ledger = ledgerOf([{ competency: S1, outcome: "wrong" }]);
    expect(tallyCompetency(ledger, "S1").wrong).toBe(0 + 1);
    expect(tallyCompetency(ledger, "S2").wrong).toBe(0);
    expect(tallyCompetency(ledger, "K1").attempts).toBe(0);
  });
});

describe("competency · 雷达数据", () => {
  it("按传入能力点导出轴，overall 为算术平均", () => {
    const ledger = ledgerOf([
      // K1: (4 - 1.5) / 5 = 0.5
      { competency: "K1", outcome: "correct" },
      { competency: "K1", outcome: "correct" },
      { competency: "K1", outcome: "correct" },
      { competency: "K1", outcome: "correct" },
      { competency: "K1", outcome: "wrong" },
      // S1: 全对 = 1
      { competency: "S1", outcome: "correct" },
      { competency: "S1", outcome: "correct" },
      { competency: "S1", outcome: "correct" },
    ]);
    const radar = buildRadarData(ledger, ["K1", "S1", "A1"]);
    expect(radar.axes).toHaveLength(3);
    expect(radar.axes[0]).toMatchObject({ code: "K1", category: "knowledge", mastery: 0.5 });
    expect(radar.axes[1]).toMatchObject({ code: "S1", category: "skill", mastery: 1 });
    expect(radar.axes[2]).toMatchObject({ code: "A1", category: "attitude", mastery: 0 });
    expect(radar.overall).toBeCloseTo(0.5, 12);
  });

  it("默认覆盖契约全部 13 个能力点", () => {
    const radar = buildRadarData(createCompetencyLedger());
    expect(radar.axes.map((axis) => axis.code)).toEqual([...ALL_COMPETENCIES]);
    expect(radar.axes).toHaveLength(13);
    expect(radar.overall).toBe(0);
  });

  it("类别映射 K/S/A 正确", () => {
    expect(competencyCategory("K3")).toBe("knowledge");
    expect(competencyCategory("S5")).toBe("skill");
    expect(competencyCategory("A2")).toBe("attitude");
  });
});
