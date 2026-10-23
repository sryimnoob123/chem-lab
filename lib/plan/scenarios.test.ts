import { describe, expect, it } from "vitest";
import { PLAN_SCENARIOS } from "./scenarios";
import { validate } from "./rules";
import { capScoreByReport } from "./llm-assess";

/**
 * 三种结果对照的守卫（2026-10-24）
 *
 * 这一块是**演给学生看**的，所以三套方案必须真的分别落在「可行 / 有故障 / 不可行」三档里 ——
 * 哪天有人改了规则或改了预制参数，这里先红，演示台上不会出现「点『危险』结果全是绿的」。
 */
describe("三种结果对照方案", () => {
  const [good, flaw, danger] = PLAN_SCENARIOS;
  const goodReport = validate(good.plan);
  const flawReport = validate(flaw.plan);
  const dangerReport = validate(danger.plan);

  it("可行：一条 block 都没有，满分", () => {
    expect(goodReport.feasible).toBe(true);
    expect(goodReport.blockCount).toBe(0);
    expect(goodReport.score).toBe(100);
  });

  it("故障：能做（无 block）但必扣分，且扣的是数值口径那两条", () => {
    expect(flawReport.feasible).toBe(true);
    expect(flawReport.blockCount).toBe(0);
    expect(flawReport.warnCount).toBeGreaterThanOrEqual(2);
    expect(flawReport.score).toBeLessThan(100);
    const codes = flawReport.issues.map((i) => i.ruleId);
    expect(codes).toContain("endpoint-hold-30s");
    expect(codes).toContain("endpoint-color-criterion");
  });

  it("危险：有 block、不可行，且 AI 分封顶后 ≤ 59", () => {
    expect(dangerReport.feasible).toBe(false);
    expect(dangerReport.blockCount).toBeGreaterThanOrEqual(1);
    const codes = dangerReport.issues.map((i) => i.ruleId);
    expect(codes).toContain("conc-acid-into-water");
    // 封顶：不可执行的方案，模型给多高都不许超过 59
    expect(capScoreByReport(95, dangerReport)).toBeLessThanOrEqual(59);
  });

  it("三套方案不是同一份（避免复制粘贴时改错对象）", () => {
    expect(flaw.plan).not.toBe(good.plan);
    expect(danger.plan.pieces.length).toBe(good.plan.pieces.length - 1);
    expect(danger.plan.params).not.toBe(good.plan.params);
  });
});
