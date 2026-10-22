import { describe, expect, it } from "vitest";
import { buildRunSummary, minutesBetween } from "./summary";

describe("实验总结", () => {
  it("高分且零事故 → great", () => {
    const s = buildRunSummary({ total: 92, incidentCount: 0, coveredSteps: 7, totalSteps: 7, minutes: 42 });
    expect(s.tone).toBe("great");
    expect(s.headline).toContain("流程完整");
  });

  it("有事故但分不低 → 不算 great", () => {
    const s = buildRunSummary({ total: 88, incidentCount: 1, coveredSteps: 7, totalSteps: 7, minutes: 42 });
    expect(s.tone).toBe("ok");
  });

  it("分低 → needs-work，提示对照实验步骤", () => {
    const s = buildRunSummary({ total: 52, incidentCount: 0, coveredSteps: 7, totalSteps: 7, minutes: 30 });
    expect(s.tone).toBe("needs-work");
    expect(s.headline).toContain("对照实验步骤");
  });

  it("步骤覆盖不足一半也判 needs-work", () => {
    const s = buildRunSummary({ total: 70, incidentCount: 0, coveredSteps: 2, totalSteps: 7, minutes: 12 });
    expect(s.tone).toBe("needs-work");
  });

  it("事故指标带 warn，无事故写「无」", () => {
    const withIncident = buildRunSummary({ total: 70, incidentCount: 2, coveredSteps: 7, totalSteps: 7, minutes: 20 });
    const incidentFact = withIncident.facts.find((f) => f.label === "事故");
    expect(incidentFact?.value).toBe("2 次");
    expect(incidentFact?.tone).toBe("warn");

    const clean = buildRunSummary({ total: 95, incidentCount: 0, coveredSteps: 7, totalSteps: 7, minutes: 20 });
    expect(clean.facts.find((f) => f.label === "事故")?.value).toBe("无");
  });

  it("步骤数不会显示成超过总数", () => {
    const s = buildRunSummary({ total: 80, incidentCount: 0, coveredSteps: 12, totalSteps: 7, minutes: 20 });
    expect(s.facts[0].value).toBe("7/7");
  });

  it("用时缺失时显示占位而不是 0 分钟", () => {
    const s = buildRunSummary({ total: 80, incidentCount: 0, coveredSteps: 7, totalSteps: 7, minutes: 0 });
    expect(s.facts[2].value).toBe("—");
  });
});

describe("minutesBetween", () => {
  it("正常计算并四舍五入到分钟", () => {
    const start = new Date("2026-10-21T10:00:00Z");
    const end = new Date("2026-10-21T10:42:30Z");
    expect(minutesBetween(start, end)).toBe(43);
  });

  it("缺任一端返回 0", () => {
    expect(minutesBetween(new Date(), null)).toBe(0);
    expect(minutesBetween(undefined, new Date())).toBe(0);
  });

  it("结束早于开始返回 0（坏数据不显示负数）", () => {
    const start = new Date("2026-10-21T10:10:00Z");
    const end = new Date("2026-10-21T10:00:00Z");
    expect(minutesBetween(start, end)).toBe(0);
  });
});
