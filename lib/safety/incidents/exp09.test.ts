import { describe, expect, it } from "vitest";
import { EXP09_INCIDENTS } from "./exp09";
import {
  FX_KEYS,
  LEVEL_RULES,
  isDeductInRange,
  type Action,
  type ActionType,
  type CompetencyCode,
  type ExperimentState,
  type HazardIncident,
  type IncidentLevel,
} from "./types";
import { hasHazard } from "../hazards";

/** 一个「什么错都没犯」的 params 全量基线：任何事故都不该被它触发 */
const SAFE_PARAMS: Record<string, number | string | boolean> = {
  order: "acid-into-water",
  container: "beaker",
  bareHand: false,
  bottle: "polyethylene",
  buretteType: "alkali",
  solution: "NaOH",
  clamp: "tight",
  forceTwist: false,
  handheldBurette: false,
  rinses: 3,
  bubbles: 0,
  rinseCount: 3,
  cooled: true,
  temp: 25,
  drops: 2,
  flow: "dropwise",
  endpoint: "faint-pink",
  parallelRuns: 3,
  ratio: "acid-over-base",
};

function makeState(stepIndex: number): ExperimentState {
  return {
    expId: "exp09",
    stepIndex,
    attemptOfStep: 1,
    entities: {},
    observations: [],
    violations: [],
    incidents: [],
    done: false,
  };
}

function act(type: ActionType, choiceId: string, params: Record<string, number | string | boolean> = {}, competency: CompetencyCode = "A1"): Action {
  return { type, choiceId, params: { ...SAFE_PARAMS, ...params }, competency };
}

/** 正向用例：每条事故各给一个「学生真这么做了」的动作 */
const POSITIVE: Array<{ incident: HazardIncident; type: ActionType; params: Record<string, number | string | boolean> }> = [
  { incident: byId("exp09-H1"), type: "dilute", params: { order: "water-into-acid" } },
  { incident: byId("exp09-H2"), type: "weigh", params: { bareHand: true } },
  { incident: byId("exp09-H3"), type: "assemble", params: { buretteType: "acid", solution: "NaOH" } },
  { incident: byId("exp09-H4"), type: "assemble", params: { handheldBurette: true } },
  { incident: byId("exp09-H5"), type: "wash", params: { rinses: 0 } },
  { incident: byId("exp09-H6"), type: "titrate", params: { bubbles: 2 } },
  { incident: byId("exp09-H7"), type: "transfer", params: { rinseCount: 0 } },
  { incident: byId("exp09-H8"), type: "titrate", params: { overTitrated: true } },
  { incident: byId("exp09-H9"), type: "dilute", params: { hotSolution: true } },
  { incident: byId("exp09-H10"), type: "transfer", params: { bottle: "glass" } },
  { incident: byId("exp09-H11"), type: "addDrops", params: { drops: 6 } },
  { incident: byId("exp09-H12"), type: "titrate", params: { flow: "stream" } },
  { incident: byId("exp09-H13"), type: "compute", params: { parallelRuns: 1 } },
  { incident: byId("exp09-H14"), type: "compute", params: { ratio: "inverted" } },
];

function byId(id: string): HazardIncident {
  const hit = EXP09_INCIDENTS.find((i) => i.id === id);
  if (!hit) throw new Error(`事故 ${id} 不存在`);
  return hit;
}

describe("exp09 事故表：结构与规格对齐", () => {
  it("共 14 条，与规格 §7 的 H1~H14 一一对应，id 唯一", () => {
    expect(EXP09_INCIDENTS).toHaveLength(14);
    const ids = EXP09_INCIDENTS.map((i) => i.id);
    expect(new Set(ids).size).toBe(14);
    for (let n = 1; n <= 14; n++) expect(ids).toContain(`exp09-H${n}`);
  });

  it("规格硬要求的四类事故都在：boil-over(L4)/burn(L3)/glass-break(L3)/device-accident(L3)", () => {
    expect(byId("exp09-H1")).toMatchObject({ fx: "boil-over", level: "L4", terminate: true });
    expect(byId("exp09-H2")).toMatchObject({ fx: "burn", level: "L3" });
    expect(byId("exp09-H3")).toMatchObject({ fx: "glass-break", level: "L3" });
    expect(byId("exp09-H4")).toMatchObject({ fx: "device-accident", level: "L3" });
  });

  it("8 个 FxKey 与合同同名同序，且每条事故的 fx 都取自这 8 个", () => {
    expect([...FX_KEYS]).toEqual([
      "boil-over",
      "explosion",
      "toxic-gas",
      "burn",
      "glass-break",
      "fire",
      "heavy-metal",
      "device-accident",
    ]);
    for (const incident of EXP09_INCIDENTS) expect(FX_KEYS).toContain(incident.fx);
  });

  it("每条事故的 why/consequence/correct 都写全（why 有原理、correct 是分步）", () => {
    for (const incident of EXP09_INCIDENTS) {
      expect(incident.title.length, `${incident.id} title`).toBeGreaterThan(6);
      expect(incident.why.length, `${incident.id} why`).toBeGreaterThanOrEqual(30);
      expect(incident.consequence.length, `${incident.id} consequence`).toBeGreaterThanOrEqual(20);
      expect(incident.correct.length, `${incident.id} correct`).toBeGreaterThanOrEqual(20);
      expect(incident.why).toMatch(/[=→]|热|反应|密度|浓度|腐蚀|压强|体积|平衡|动能|重力|能量/);
    }
  });

  it("refs 全部存在于 hazards 库，且非空", () => {
    for (const incident of EXP09_INCIDENTS) {
      expect(incident.refs.length, `${incident.id} 无 refs`).toBeGreaterThan(0);
      for (const ref of incident.refs) {
        expect(hasHazard(ref), `${incident.id} 引用了不存在的规范 ${ref}`).toBe(true);
      }
    }
  });
});

describe("exp09 事故表：扣分与终止规则（契约 §5）", () => {
  it("每条扣分都落在自己级别的合法区间，不越界", () => {
    for (const incident of EXP09_INCIDENTS) {
      expect(isDeductInRange(incident.level, incident.deduct), `${incident.id} 扣分越界`).toBe(true);
      const rule = LEVEL_RULES[incident.level];
      expect(incident.deduct).toBeGreaterThanOrEqual(rule.min);
      expect(incident.deduct).toBeLessThanOrEqual(rule.max);
    }
  });

  it("L4 一律 terminate=true；L1~L3 一律 false", () => {
    for (const incident of EXP09_INCIDENTS) {
      expect(incident.terminate, `${incident.id}`).toBe(incident.level === "L4");
    }
    const l4 = EXP09_INCIDENTS.filter((i) => i.level === "L4");
    expect(l4).toHaveLength(1);
    expect(l4[0].deduct).toBe(20);
  });

  it("级别分布符合规格 §5 的 L4×1 / L3×3 / L2×6 / L1×4", () => {
    const dist = EXP09_INCIDENTS.reduce<Record<IncidentLevel, number>>(
      (acc, i) => ({ ...acc, [i.level]: acc[i.level] + 1 }),
      { L1: 0, L2: 0, L3: 0, L4: 0 },
    );
    expect(dist).toEqual({ L1: 4, L2: 6, L3: 3, L4: 1 });
  });

  it("L1/L2 标为无动画（fxSilent），L3/L4 必须有动画", () => {
    for (const incident of EXP09_INCIDENTS) {
      expect(Boolean(incident.fxSilent), `${incident.id}`).toBe(incident.level === "L1" || incident.level === "L2");
    }
  });

  it("stepNo 落在实验 9 的 7 步之内", () => {
    for (const incident of EXP09_INCIDENTS) {
      expect(Number.isInteger(incident.stepNo)).toBe(true);
      expect(incident.stepNo).toBeGreaterThanOrEqual(1);
      expect(incident.stepNo).toBeLessThanOrEqual(7);
    }
  });
});

describe("exp09 事故判定：纯函数 trigger", () => {
  it.each(POSITIVE.map((c) => [c.incident.id, c] as const))("%s 在正确步号+错误动作下触发", (_id, c) => {
    const state = makeState((c.incident.stepNo ?? 1) - 1);
    expect(c.incident.trigger(state, act(c.type, `exp09-trap-${c.incident.id}`, c.params))).toBe(true);
  });

  it.each(POSITIVE.map((c) => [c.incident.id, c] as const))("%s 在「全都做对」的动作下不触发", (_id, c) => {
    const state = makeState((c.incident.stepNo ?? 1) - 1);
    expect(c.incident.trigger(state, act(c.type, "exp09-correct-step"))).toBe(false);
  });

  it.each(POSITIVE.map((c) => [c.incident.id, c] as const))("%s 换个步号做同样的错事不触发", (_id, c) => {
    const step = (c.incident.stepNo ?? 1) - 1;
    const wrongStep = step === 0 ? 1 : 0;
    expect(c.incident.trigger(makeState(wrongStep), act(c.type, "exp09-trap", c.params))).toBe(false);
  });

  it("7 个步骤上各做一次「规范动作」，一条事故都不触发（不会误伤）", () => {
    for (let stepIndex = 0; stepIndex < 7; stepIndex++) {
      for (const incident of EXP09_INCIDENTS) {
        expect(incident.trigger(makeState(stepIndex), act("observe", "exp09-correct-step"))).toBe(false);
      }
    }
  });

  it("水入浓盐酸（L4）只在步2、且只在水进酸时触发", () => {
    const h1 = byId("exp09-H1");
    expect(h1.trigger(makeState(1), act("dilute", "x", { order: "water-into-acid" }))).toBe(true);
    expect(h1.trigger(makeState(1), act("dilute", "x", { order: "acid-into-water" }))).toBe(false);
    expect(h1.trigger(makeState(0), act("dilute", "x", { order: "water-into-acid" }))).toBe(false);
  });

  it("也认 choiceId 语义 token（定义文件不填 params 时仍能判定）", () => {
    expect(byId("exp09-H1").trigger(makeState(1), { type: "dilute", choiceId: "exp09-step2-water-into-acid", competency: "A1" })).toBe(true);
    expect(byId("exp09-H3").trigger(makeState(3), { type: "assemble", choiceId: "exp09-step4-naoh-in-acid-burette", competency: "S1" })).toBe(true);
    expect(byId("exp09-H13").trigger(makeState(6), { type: "compute", choiceId: "exp09-step7-single-run", competency: "S2" })).toBe(true);
  });

  it("trigger 无副作用：同一输入调用两次结果一致，state 不被修改", () => {
    const state = makeState(1);
    const frozen = JSON.stringify(state);
    const action = act("dilute", "x", { order: "water-into-acid" });
    const h1 = byId("exp09-H1");
    expect(h1.trigger(state, action)).toBe(true);
    expect(h1.trigger(state, action)).toBe(true);
    expect(JSON.stringify(state)).toBe(frozen);
    expect(state.incidents).toHaveLength(0);
  });
});

/**
 * 与已交付的 `experiments/exp09/definition.ts` 对齐：
 * 定义文件里 trap 的 choiceId 就是学生在界面上点的那一下，必须能命中本表对应的事故，
 * 否则「学生点错了但没有事故」= 安全层漏判。
 */
const DEFINITION_CHOICE_TO_INCIDENT: Array<[choiceId: string, incidentId: string, stepNo: number]> = [
  ["step1-bare-hands-naoh", "exp09-H2", 1],
  ["step1-glass-stopper", "exp09-H10", 1],
  ["step1-hot-dissolve", "exp09-H9", 1],
  ["step2-water-into-acid", "exp09-H1", 2],
  ["step3-tap-water-only", "exp09-H5", 3],
  ["step4-skip-bubble", "exp09-H6", 4],
  ["step4-naoh-in-acid-burette", "exp09-H3", 4],
  ["step4-hold-burette-tilted", "exp09-H4", 4],
  ["step5-skip-rinse", "exp09-H7", 5],
  ["step5-excess-indicator", "exp09-H11", 5],
  ["step6-over-titrate", "exp09-H8", 6],
  ["step6-line-flow", "exp09-H12", 6],
  ["step7-single-trial", "exp09-H13", 7],
  ["step7-inverted-ratio", "exp09-H14", 7],
];

describe("exp09 事故判定：与 definition.ts 的真实 choiceId 对齐", () => {
  it.each(DEFINITION_CHOICE_TO_INCIDENT)(
    "学生点 %s 命中 %s（第 %d 步）",
    (choiceId, incidentId, stepNo) => {
      // it.each 按元组顺序展开参数：(choiceId, incidentId, stepNo)
      const incident = byId(incidentId);
      expect(incident.stepNo).toBe(stepNo);
      const state = makeState(stepNo - 1);
      const action: Action = { type: "observe", choiceId, competency: "A1" };
      expect(incident.trigger(state, action), `${choiceId} 应命中 ${incidentId}`).toBe(true);
    },
  );

  it("反过来：正确动作的 choiceId 不会误命中任何事故", () => {
    const correctChoices: Array<[string, number]> = [
      ["step1-weigh", 1],
      ["step1-dissolve", 1],
      ["step1-transfer", 1],
      ["step2-add-water", 2],
      ["step2-measure-acid", 2],
      ["step2-add-acid", 2],
      ["step2-transfer", 2],
      ["step3-inspect", 3],
      ["step3-wash", 3],
      ["step3-rinse", 3],
      ["step4-clamp", 4],
      ["step4-fill", 4],
      ["step4-zero", 4],
      ["step5-rinse-pipette", 5],
      ["step5-pipette", 5],
      ["step5-indicator", 5],
      ["step6-titrate-fast", 6],
      ["step6-half-drop", 6],
      ["step6-read-end", 6],
      ["step7-repeat", 7],
      ["step7-record", 7],
      ["step7-compute", 7],
    ];
    for (const [choiceId, stepNo] of correctChoices) {
      const state = makeState(stepNo - 1);
      const action: Action = { type: "observe", choiceId, competency: "A1" };
      const hit = EXP09_INCIDENTS.filter((incident) => incident.trigger(state, action)).map((i) => i.id);
      expect(hit, `${choiceId} 误命中`).toEqual([]);
    }
  });
});
