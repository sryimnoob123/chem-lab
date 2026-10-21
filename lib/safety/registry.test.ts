import { describe, expect, it } from "vitest";
import {
  EXP_IDS_WITH_INCIDENTS,
  INCIDENTS_BY_EXP,
  detectFirstIncident,
  detectIncidents,
  getIncident,
  getIncidents,
  incidentCount,
  validateRegistry,
} from "./registry";
import type { Action, ExperimentState } from "./incidents/types";

function makeState(stepIndex: number, expId = "exp09"): ExperimentState {
  return {
    expId,
    stepIndex,
    attemptOfStep: 1,
    entities: {},
    observations: [],
    violations: [],
    incidents: [],
    done: false,
  };
}

function act(type: Action["type"], params: Record<string, number | string | boolean> = {}): Action {
  return { type, choiceId: "exp09-test", params, competency: "A1" };
}

describe("事故注册表 registry", () => {
  it("按 expId 汇总：exp09 暴露 14 条，未知实验返回空数组而不抛错", () => {
    expect(EXP_IDS_WITH_INCIDENTS).toContain("exp09");
    expect(getIncidents("exp09")).toHaveLength(14);
    expect(getIncidents("exp99")).toEqual([]);
    expect(incidentCount()).toBe(14);
    expect(Object.keys(INCIDENTS_BY_EXP)).toContain("exp09");
  });

  it("getIncident 全局反查，未知 id 返回 undefined", () => {
    expect(getIncident("exp09-H1")?.level).toBe("L4");
    expect(getIncident("exp09-H14")?.competency).toBe("K1");
    expect(getIncident("exp09-H99")).toBeUndefined();
    expect(getIncident("")).toBeUndefined();
  });

  it("整表通过自检：validateRegistry() 无问题（扣分区间/L4 终止/refs 存在/id 唯一）", () => {
    expect(validateRegistry()).toEqual([]);
  });

  it("正常动作不产生事故；detectIncidents 返回空数组", () => {
    expect(detectIncidents("exp09", makeState(1), act("dilute", { order: "acid-into-water" }))).toEqual([]);
    expect(detectFirstIncident("exp09", makeState(1), act("dilute", { order: "acid-into-water" }))).toBeUndefined();
  });

  it("水入浓盐酸命中 L4 且 terminate=true（引擎据此终止本次实验）", () => {
    const hit = detectFirstIncident("exp09", makeState(1), act("dilute", { order: "water-into-acid" }));
    expect(hit?.id).toBe("exp09-H1");
    expect(hit?.level).toBe("L4");
    expect(hit?.fx).toBe("boil-over");
    expect(hit?.terminate).toBe(true);
  });

  it("同一动作踩多条时，detectFirstIncident 取级别最高的那条（不随机）", () => {
    const state = makeState(3); // 步4
    const action = act("titrate", { bubblesInTip: true, handheldBurette: true });
    const all = detectIncidents("exp09", state, action).map((i) => i.id);
    expect(all).toEqual(["exp09-H4", "exp09-H6"]); // 声明序
    expect(detectFirstIncident("exp09", state, action)?.id).toBe("exp09-H4"); // L3 优先于 L2
    expect(detectFirstIncident("exp09", state, action)?.id).toBe("exp09-H4"); // 再算一次，稳定
  });

  it("未知实验的检测一律安全返回（引擎不用写 if）", () => {
    expect(detectIncidents("exp99", makeState(1, "exp99"), act("dilute", { order: "water-into-acid" }))).toEqual([]);
    expect(detectFirstIncident("exp99", makeState(1, "exp99"), act("dilute"))).toBeUndefined();
  });

  it("返回的是同一份只读引用（UI/引擎不复制对象，避免文案漂移）", () => {
    expect(getIncidents("exp09")[0]).toBe(getIncident("exp09-H1"));
  });
});
