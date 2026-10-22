/**
 * 主题约束单测：卡片上写给学生的那几条，必须真的能判。
 *
 * 覆盖三类容易错的地方：
 * 1. 主题推荐的素材 id 拼错 → 素材库置顶不到东西（静默失效，最难发现）；
 * 2. 主题规则漏判 → 学生把错方案拼到 100 分；
 * 3. 叠加扣分口径与基础规则不一致 → 出现两套分数。
 */

import { describe, expect, it } from "vitest";
import { REFERENCE_PLAN, PIECES_BY_ID, type PlanInput } from "./pieces";
import { validate } from "./rules";
import { PLAN_TOPICS, applyTopic, getTopic, topicReport } from "./topics";

const empty: PlanInput = { pieces: [], params: {} };

describe("主题定义", () => {
  it("每个主题都有情境 / 目标 / 2~3 条硬约束", () => {
    for (const topic of PLAN_TOPICS) {
      expect(topic.title.length).toBeGreaterThan(0);
      expect(topic.scene.length).toBeGreaterThan(0);
      expect(topic.goal.length).toBeGreaterThan(0);
      expect(topic.constraints.length).toBeGreaterThanOrEqual(2);
      expect(topic.constraints.length).toBeLessThanOrEqual(3);
      expect(topic.constraints.length).toBe(topic.rules.length);
    }
  });

  it("推荐素材 id 都真实存在（拼错会让置顶静默失效）", () => {
    for (const topic of PLAN_TOPICS) {
      expect(topic.featured.length).toBeGreaterThan(0);
      for (const id of topic.featured) {
        expect(PIECES_BY_ID[id], `${topic.id} 的素材 ${id} 不存在`).toBeDefined();
      }
    }
  });

  it("主题 id 唯一，getTopic 能按 id 取回", () => {
    const ids = PLAN_TOPICS.map((t) => t.id);
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
      expect(extra.issues.length).toBe(topic.rules.filter((r) => !r.check(empty)).length);
      expect(extra.issues.length).toBeGreaterThan(0);
      expect(extra.failed.length).toBe(extra.issues.length);
    }
  });

  it("参考方案能通过「盐酸标定」主题的三条约束", () => {
    const topic = getTopic("topic-hcl-standard");
    const extra = topicReport(REFERENCE_PLAN, topic);
    expect(extra.issues).toHaveLength(0);
    expect(extra.passed).toHaveLength(3);
  });

  it("选了 KHP 主题却用 Na₂CO₃ 会被判混用（warn）", () => {
    const topic = getTopic("topic-acid-acceptance");
    const plan: PlanInput = { pieces: ["piece-khp", "piece-na2co3-primary", "piece-burette-acid"], params: {} };
    const extra = topicReport(plan, topic);
    const mixed = extra.issues.find((i) => i.ruleId === "topic-acceptance-single-standard");
    expect(mixed?.level).toBe("warn");
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
    expect(merged.issues.some((i) => i.ruleId.startsWith("topic-"))).toBe(true);
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
