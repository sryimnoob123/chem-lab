/**
 * 点评（P1）单测：结构必须稳定，且要点必须**指到具体片段**。
 *
 * 明天接扣子（provider=coze/ark）后，`text` 会换成模型输出，但
 * `points` / `questions` 的形状不能变 —— 前端靠它渲染「哪一块、为什么不行」。
 */

import { describe, expect, it } from "vitest";
import { REFERENCE_PLAN, type PlanInput } from "./pieces";
import { validate } from "./rules";
import { applyTopic, getTopic } from "./topics";
import { mockAssess, providerOf } from "./llm-assess";

const report = (plan: PlanInput) => applyTopic(validate(plan), plan, getTopic("topic-hcl-standard"));

describe("mock 点评", () => {
  it("结构完整：text 非空、points 有 kind、questions 最多两条", () => {
    const plan = REFERENCE_PLAN;
    const result = mockAssess(plan, report(plan), getTopic("topic-hcl-standard"));
    expect(result.provider).toBe("mock");
    expect(result.text.length).toBeGreaterThan(10);
    expect(result.points.length).toBeGreaterThan(0);
    for (const point of result.points) {
      expect(["good", "risk", "todo"]).toContain(point.kind);
      expect(point.text.length).toBeGreaterThan(4);
    }
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.questions.length).toBeLessThanOrEqual(2);
  });

  it("缺基准物时点出「还缺『无水 Na₂CO₃…』」，不是泛泛而谈", () => {
    const plan: PlanInput = { pieces: ["piece-burette-acid"], params: {} };
    const result = mockAssess(plan, report(plan), getTopic("topic-hcl-standard"));
    const risk = result.points.find((p) => p.kind === "risk");
    expect(risk?.pieceId).toBe("piece-na2co3-primary");
    expect(risk?.text).toContain("还缺");
    expect(risk?.text).toContain("无水 Na₂CO₃");
  });

  it("空方案也给一条能动的建议（不许空白）", () => {
    const plan: PlanInput = { pieces: [], params: {} };
    const result = mockAssess(plan, report(plan), undefined);
    expect(result.points.some((p) => p.kind === "todo")).toBe(true);
    expect(result.text).not.toHaveLength(0);
  });
});

describe("provider 选择", () => {
  it("没有配置 key 时走 mock（本地演示不需要网络）", () => {
    const saved = { ...process.env };
    delete process.env.COZE_API_TOKEN;
    delete process.env.COZE_BOT_ID;
    delete process.env.ARK_API_KEY;
    delete process.env.PLAN_ASSESS_PROVIDER;
    expect(providerOf()).toBe("mock");
    process.env = saved;
  });
});
