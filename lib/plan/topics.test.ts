/**
 * 主题约束单测：卡片上写给学生的那几条，必须真的能判、且指回具体素材块。
 *
 * 覆盖四类容易错的地方：
 * 1. 主题推荐的素材 id 拼错 → 素材库置顶不到东西（静默失效，最难发现）；
 * 2. 约束与规则对不上（卡片要 X，规则不管 X）→ 学生照做还掉分；
 * 3. 主题规则不可满足 / 永远通过 → 主题变成摆设；
 * 4. 难度梯度不成立（四个主题一样难）→ 卡片顺序失去意义。
 */

import { describe, expect, it } from "vitest";
import { REFERENCE_PLAN, PIECES_BY_ID, type PlanInput } from "./pieces";
import { validate } from "./rules";
import { PLAN_TOPICS, applyTopic, getTopic, topicReport, type PlanTopic } from "./topics";

const empty: PlanInput = { pieces: [], params: {} };

/** 以参考方案为底：删掉某些块（参考方案本身就是 100 分基线） */
function planWithout(...drop: string[]): PlanInput {
  return { pieces: REFERENCE_PLAN.pieces.filter((id) => !drop.includes(id)), params: REFERENCE_PLAN.params };
}

/** 每个主题一份「能全过」的方案：规则若自相矛盾，这里先红 */
const PASSING: Record<string, PlanInput> = {
  "topic-hcl-standard": planWithout(),
  "topic-acid-acceptance": {
    pieces: [...REFERENCE_PLAN.pieces.filter((id) => id !== "piece-na2co3-primary"), "piece-khp"],
    params: REFERENCE_PLAN.params,
  },
  "topic-co2-blank": planWithout(),
  "topic-soda-alkalinity": planWithout(),
};

describe("主题定义", () => {
  it("每个主题都有情境 / 目标 / 2~3 条硬约束", () => {
    for (const topic of PLAN_TOPICS) {
      expect(topic.title.length).toBeGreaterThan(0);
      expect(topic.scene.length).toBeGreaterThan(12);
      expect(topic.goal.length).toBeGreaterThan(8);
      expect(topic.constraints.length).toBeGreaterThanOrEqual(2);
      expect(topic.constraints.length).toBeLessThanOrEqual(3);
      expect(topic.constraints.length).toBe(topic.rules.length);
    }
  });

  it("约束 ↔ 规则一一对应（卡片要 X，规则必须判 X）", () => {
    for (const topic of PLAN_TOPICS) {
      const codes = topic.rules.map((rule) => rule.code);
      expect(new Set(codes).size, `${topic.id} 规则 code 重复`).toBe(codes.length);
      for (const constraint of topic.constraints) {
        expect(codes, `${topic.id} 的约束「${constraint.text}」没有对应规则`).toContain(constraint.ruleCode);
      }
      for (const rule of topic.rules) {
        expect(
          topic.constraints.some((constraint) => constraint.ruleCode === rule.code),
          `${topic.id} 的规则 ${rule.code} 没有出现在卡片上`,
        ).toBe(true);
      }
    }
  });

  it("必选规则的责任块在 featured 里；禁用块不进推荐列表", () => {
    for (const topic of PLAN_TOPICS) {
      for (const rule of topic.rules) {
        expect(PIECES_BY_ID[rule.pieceId], `${topic.id}/${rule.code} 的 pieceId 不存在`).toBeDefined();
        if (rule.forbidden) {
          expect(topic.featured, `${topic.id}/${rule.code} 的禁用块不该出现在推荐列表`).not.toContain(rule.pieceId);
        } else {
          expect(topic.featured, `${topic.id}/${rule.code} 的责任块不在 featured 里`).toContain(rule.pieceId);
        }
      }
    }
  });

  it("推荐素材 id 都真实存在且不重复", () => {
    for (const topic of PLAN_TOPICS) {
      expect(topic.featured.length).toBeGreaterThan(0);
      expect(new Set(topic.featured).size).toBe(topic.featured.length);
      for (const id of topic.featured) {
        expect(PIECES_BY_ID[id], `${topic.id} 的素材 ${id} 不存在`).toBeDefined();
      }
    }
  });

  it("难度梯度：入门 → 综合，档位不回头，level 与 difficulty 对齐", () => {
    const levelOf = { 入门: 1, 进阶: 2, 综合: 3 } as const;
    const ladder = PLAN_TOPICS.map((topic) => topic.difficulty);
    expect(ladder[0]).toBe(1);
    expect(ladder[ladder.length - 1]).toBe(3);
    for (let index = 1; index < ladder.length; index += 1) {
      expect(ladder[index]).toBeGreaterThanOrEqual(ladder[index - 1]);
    }
    expect(new Set(PLAN_TOPICS.map((topic) => topic.level))).toEqual(new Set(["入门", "进阶", "综合"]));
    for (const topic of PLAN_TOPICS) {
      expect(topic.difficulty).toBe(levelOf[topic.level]);
    }
  });

  it("每个主题自带 1~2 条追问，且不同主题的追问不同", () => {
    const seen = new Set<string>();
    for (const topic of PLAN_TOPICS) {
      expect(topic.questions.length).toBeGreaterThanOrEqual(1);
      expect(topic.questions.length).toBeLessThanOrEqual(2);
      for (const question of topic.questions) {
        expect(question.length).toBeGreaterThan(8);
        expect(seen.has(question), `追问重复：${question}`).toBe(false);
        seen.add(question);
      }
    }
  });

  it("主题 id 唯一，getTopic 能按 id 取回", () => {
    const ids = PLAN_TOPICS.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getTopic(ids[0])?.id).toBe(ids[0]);
    expect(getTopic("nope")).toBeUndefined();
    expect(getTopic(null)).toBeUndefined();
  });
});

describe("主题校验", () => {
  it("空方案时每个主题都会报出硬约束（不会静默给满分）", () => {
    for (const topic of PLAN_TOPICS) {
      const extra = topicReport(empty, topic);
      expect(extra.issues.length).toBe(topic.rules.filter((rule) => !rule.check(empty)).length);
      expect(extra.issues.length).toBeGreaterThan(0);
      expect(extra.failed.length).toBe(extra.issues.length);
    }
  });

  it("每个主题都存在一份能全过的方案（规则不自相矛盾）", () => {
    for (const topic of PLAN_TOPICS) {
      const extra = topicReport(PASSING[topic.id], topic);
      expect(extra.issues, `${topic.id} 的规则无法同时满足`).toHaveLength(0);
      expect(extra.passed).toHaveLength(topic.rules.length);
    }
  });

  it("每条主题规则都真的会判（不是永远 true）", () => {
    for (const topic of PLAN_TOPICS) {
      const passing = PASSING[topic.id];
      for (const rule of topic.rules) {
        const failing: PlanInput = rule.forbidden
          ? { pieces: [...passing.pieces, rule.pieceId], params: passing.params }
          : { pieces: passing.pieces.filter((id) => id !== rule.pieceId), params: passing.params };
        expect(rule.check(failing), `${topic.id}/${rule.code} 删掉责任块后仍然通过`).toBe(false);
      }
    }
  });

  it("参考方案能通过「盐酸标定」主题的三条约束", () => {
    const topic = getTopic("topic-hcl-standard");
    const extra = topicReport(REFERENCE_PLAN, topic);
    expect(extra.issues).toHaveLength(0);
    expect(extra.passed).toHaveLength(3);
    for (const code of extra.passed) {
      expect(topic?.rules.some((rule) => rule.code === code), `passed 里应是规则 code：${code}`).toBe(true);
    }
  });

  it("选了 KHP 主题却用 Na₂CO₃ 会被判混用（warn）", () => {
    const topic = getTopic("topic-acid-acceptance");
    const plan: PlanInput = { pieces: ["piece-khp", "piece-na2co3-primary", "piece-burette-acid"], params: {} };
    const extra = topicReport(plan, topic);
    const mixed = extra.issues.find((issue) => issue.ruleId === "topic-acceptance-single-standard");
    expect(mixed?.level).toBe("warn");
  });

  it("主题报告的问题都能指回素材块（给点评用）", () => {
    for (const topic of PLAN_TOPICS) {
      const extra = topicReport(empty, topic as PlanTopic);
      for (const issue of extra.issues) {
        const rule = topic.rules.find((item) => item.code === issue.ruleId);
        expect(rule?.pieceId).toBeTruthy();
        expect(PIECES_BY_ID[rule?.pieceId ?? ""]).toBeDefined();
      }
    }
  });
});

describe("主题叠加到评分", () => {
  it("没有主题时原样返回（不复制、不加分、不扣分）", () => {
    const base = validate(REFERENCE_PLAN);
    expect(applyTopic(base, REFERENCE_PLAN, undefined)).toBe(base);
  });

  it("空方案 + 主题：扣分后仍是 0 分，且不算可行", () => {
    const topic = getTopic("topic-soda-alkalinity");
    const merged = applyTopic(validate(empty), empty, topic);
    expect(merged.score).toBe(0);
    expect(merged.feasible).toBe(false);
    expect(merged.blockCount).toBeGreaterThan(0);
    expect(merged.issues.some((issue) => issue.ruleId.startsWith("topic-"))).toBe(true);
  });

  it("基础全过的方案 + 主题：主题规则也进 byRule，分数仍是 100", () => {
    const topic = getTopic("topic-hcl-standard");
    if (!topic) throw new Error("主题 topic-hcl-standard 不存在");
    const merged = applyTopic(validate(REFERENCE_PLAN), REFERENCE_PLAN, topic);
    expect(merged.score).toBe(100);
    expect(merged.feasible).toBe(true);
    for (const rule of topic.rules) {
      expect(merged.byRule[rule.code]).toBe(true);
    }
    expect(merged.passed.length).toBeGreaterThan(validate(REFERENCE_PLAN).passed.length);
  });
});
