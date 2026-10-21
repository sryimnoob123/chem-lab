import { describe, expect, it } from "vitest";

import type { CompetencyCode } from "./competency";
import {
  appendError,
  clearCompetencyHistory,
  decideHint,
  hintTextKey,
  isDeductibleHint,
  levelForStepAttempt,
  recordErrorAndDecide,
  toHintUsage,
  type HintErrorRecord,
} from "./hints";

const K1: CompetencyCode = "K1";
const S1: CompetencyCode = "S1";

/** 构造错误历史的小工具，避免每条测试都写对象字面量。 */
function errors(competency: CompetencyCode, stepIndexes: readonly number[]): HintErrorRecord[] {
  return stepIndexes.map((stepIndex) => ({ competency, stepIndex }));
}

function decide(
  history: readonly HintErrorRecord[],
  competency: CompetencyCode,
  stepIndex: number,
) {
  return decideHint({ expId: "exp09", competency, stepIndex, history });
}

describe("hints · 阶梯逐级推进", () => {
  it("第 1 次错给 H0", () => {
    const decision = decide([], K1, 2);
    expect(decision.level).toBe(0);
    expect(decision.stepAttempt).toBe(1);
    expect(decision.shouldDeduct).toBe(false);
    expect(decision.textKey).toBe("hint.exp09.step3.H0");
  });

  it("同一步第 2 次错给 H1", () => {
    const decision = decide(errors(K1, [2]), K1, 2);
    expect(decision.level).toBe(1);
    expect(decision.stepAttempt).toBe(2);
    expect(decision.textKey).toBe("hint.exp09.step3.H1");
  });

  it("同一步第 3 次错给 H2 并开始扣独立完成度", () => {
    const decision = decide(errors(K1, [2, 2]), K1, 2);
    expect(decision.level).toBe(2);
    expect(decision.stepAttempt).toBe(3);
    expect(decision.shouldDeduct).toBe(true);
    expect(decision.metacognitive).toBe(false);
  });

  it("同一步第 4 次错给 H3", () => {
    const decision = decide(errors(K1, [2, 2, 2]), K1, 2);
    expect(decision.level).toBe(3);
    expect(decision.stepAttempt).toBe(4);
  });

  it("同一步第 5 次及以后封顶 H3，不会自动跳 H4", () => {
    const decision = decide(errors(K1, [2, 2, 2, 2, 2]), K1, 2);
    expect(decision.level).toBe(3);
    expect(decision.stepAttempt).toBe(6);
    expect(decision.metacognitive).toBe(false);
  });

  it("levelForStepAttempt 覆盖 0/负数/非有限值等边界", () => {
    expect([1, 2, 3, 4, 5].map(levelForStepAttempt)).toEqual([0, 1, 2, 3, 3]);
    expect(levelForStepAttempt(0)).toBe(0);
    expect(levelForStepAttempt(-3)).toBe(0);
    expect(levelForStepAttempt(Number.NaN)).toBe(0);
  });

  it("文案键按 1-based 步骤号拼接", () => {
    expect(hintTextKey("exp09", 0, 0)).toBe("hint.exp09.step1.H0");
    expect(hintTextKey("exp09", 5, 2)).toBe("hint.exp09.step6.H2");
    expect(hintTextKey("exp09", 5, 3)).toBe("hint.exp09.step6.H3");
  });
});

describe("hints · 连续同类错误跳 H4", () => {
  it("同一能力点连续 3 次错、跨 3 个步骤 → H4 元认知提示", () => {
    const decision = decide(errors(K1, [0, 1]), K1, 2);
    expect(decision.level).toBe(4);
    expect(decision.metacognitive).toBe(true);
    expect(decision.competencyStreak).toBe(3);
    expect(decision.textKey).toBe("hint.exp09.meta.H4");
    expect(decision.shouldDeduct).toBe(true);
  });

  it("同一步内连续 3 次错只到 H2，不满足“跨步”条件", () => {
    const decision = decide(errors(K1, [3, 3]), K1, 3);
    expect(decision.level).toBe(2);
    expect(decision.metacognitive).toBe(false);
  });

  it("前 2 次在同一步、第 3 次换步仍算跨步 → H4", () => {
    const decision = decide(errors(K1, [1, 1]), K1, 2);
    expect(decision.level).toBe(4);
    expect(decision.competencyStreak).toBe(3);
  });

  it("中间隔着其他能力点的错误会打断连续计数", () => {
    const history = [...errors(K1, [0, 1]), ...errors(S1, [2])];
    const decision = decide(history, K1, 3);
    expect(decision.level).toBe(0);
    expect(decision.competencyStreak).toBe(1);
    expect(decision.metacognitive).toBe(false);
  });
});

describe("hints · 跨能力点不串号", () => {
  it("其他能力点的历史错误不推进本能力点阶梯", () => {
    const decision = decide(errors(K1, [0, 1]), S1, 2);
    expect(decision.level).toBe(0);
    expect(decision.stepAttempt).toBe(1);
  });

  it("同一步里其他能力点的错误不计入本能力点同步骤尝试数", () => {
    const decision = decide(errors(S1, [5]), K1, 5);
    expect(decision.level).toBe(0);
    expect(decision.stepAttempt).toBe(1);
  });

  it("H4 只统计同 competency 的连续错误", () => {
    const history = [
      ...errors(K1, [0]),
      ...errors(S1, [1]),
      ...errors(S1, [2]),
    ];
    const decision = decide(history, S1, 3);
    expect(decision.level).toBe(4);
    expect(decision.competency).toBe(S1);
  });
});

describe("hints · 状态机与扣分口径", () => {
  it("recordErrorAndDecide 返回追加后的历史，下一次同步骤自动升级", () => {
    const first = recordErrorAndDecide({
      expId: "exp09",
      competency: S1,
      stepIndex: 2,
      history: [],
    });
    expect(first.decision.level).toBe(0);
    expect(first.history).toHaveLength(1);

    const second = recordErrorAndDecide({
      expId: "exp09",
      competency: S1,
      stepIndex: 2,
      history: first.history,
    });
    expect(second.decision.level).toBe(1);
    expect(second.history).toHaveLength(2);
  });

  it("appendError 不修改原历史", () => {
    const history: HintErrorRecord[] = [];
    const next = appendError(history, { competency: K1, stepIndex: 0 });
    expect(history).toHaveLength(0);
    expect(next).toHaveLength(1);
  });

  it("clearCompetencyHistory 只清除指定能力点", () => {
    const history = [...errors(K1, [0, 1]), ...errors(S1, [2])];
    const cleared = clearCompetencyHistory(history, K1);
    expect(cleared).toEqual(errors(S1, [2]));
    expect(history).toHaveLength(3);
  });

  it("只有 H2 及以上才扣独立完成度", () => {
    expect(isDeductibleHint(0)).toBe(false);
    expect(isDeductibleHint(1)).toBe(false);
    expect(isDeductibleHint(2)).toBe(true);
    expect(isDeductibleHint(3)).toBe(true);
    expect(isDeductibleHint(4)).toBe(true);
  });

  it("决策可无损转成 HintUsage 供计分聚合", () => {
    const decision = decide(errors(K1, [2, 2]), K1, 2);
    expect(toHintUsage(decision)).toEqual({ competency: K1, stepIndex: 2, level: 2 });
  });
});
