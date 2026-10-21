import { describe, expect, it } from "vitest";

import { ACTION_VERB } from "./copy";
import { stepVerb, verbFromTitle } from "./step-verb";

describe("verbFromTitle", () => {
  it("负责红队报的三条：认领 / 配母液 / 数据处理", () => {
    expect(verbFromTitle("仪器认领、洗涤与干燥")).toBe("认领");
    expect(verbFromTitle("配母液与安全操作")).toBe("配制");
    expect(verbFromTitle("数据处理与电极保养")).toBe("处理数据");
  });

  it("洗涤优先于干燥（同一步里先洗后烘干）", () => {
    expect(verbFromTitle("洗涤与干燥")).toBe("洗涤");
  });

  it("检漏排在最前：滴定管检漏、洗涤与润洗", () => {
    expect(verbFromTitle("滴定管检漏、洗涤与润洗")).toBe("检漏");
  });

  it("称量 / 滴定 / 终点 / 装液", () => {
    expect(verbFromTitle("称 NaOH 配约 0.1 mol/L 溶液 500 mL")).toBe("称量");
    expect(verbFromTitle("滴定至终点")).toBe("滴定");
    expect(verbFromTitle("装液、排气泡、调零")).toBe("装液");
  });

  it("推不出来返回 null", () => {
    expect(verbFromTitle("")).toBeNull();
    expect(verbFromTitle("实验小结")).toBeNull();
  });
});

describe("stepVerb", () => {
  it("标题能推就用标题（不被 suggested.type 带偏）", () => {
    expect(stepVerb("仪器认领、洗涤与干燥", "observe", ACTION_VERB)).toBe("认领");
  });

  it("标题推不出来才退回动作类型", () => {
    expect(stepVerb("实验小结", "weigh", ACTION_VERB)).toBe("称量");
  });

  it("两边都没有给兜底词", () => {
    expect(stepVerb("实验小结", undefined, ACTION_VERB)).toBe("操作");
  });
});
