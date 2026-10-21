import { describe, expect, it } from "vitest";
import { REFERENCE_PLAN, type PlanInput } from "./pieces";
import {
  BLOCK_DEDUCT,
  MAX_SCORE,
  RULES,
  RULES_BY_CODE,
  WARN_DEDUCT,
  toApiResult,
  validate,
  unknownPieces,
  type PlanReport,
  type RuleLevel,
} from "./rules";

/** 从参考方案派生变体：删/加块 + 覆盖参数 */
function variant(opts: {
  remove?: readonly string[];
  add?: readonly string[];
  params?: Record<string, string | number | boolean>;
}): PlanInput {
  const remove = new Set(opts.remove ?? []);
  return {
    pieces: [...REFERENCE_PLAN.pieces.filter((id) => !remove.has(id)), ...(opts.add ?? [])],
    params: { ...REFERENCE_PLAN.params, ...(opts.params ?? {}) },
  };
}

/** 规格点名的 18 条规则（code 与 label 一一对应，改动需同步 docs/实验库/exp10.md） */
const REQUIRED_CODES = [
  "std-primary-standard",
  "total-alkalinity-dual-indicator",
  "endpoint-color-criterion",
  "burette-rinse",
  "burette-degas-zero",
  "primary-standard-dried",
  "analytical-balance",
  "parallel-min-and-range",
  "conc-acid-into-water",
  "naoh-co2-free-water",
  "no-mouth-pipetting",
  "flask-receiving",
  "half-drop-touch-wall",
  "near-endpoint-dropwise",
  "indicator-1-2-drops",
  "parallel-same-batch",
  "reading-two-decimals",
  "endpoint-hold-30s",
];

describe("规则表结构", () => {
  it("规则总数 18~23（指定 18 条 + 3 条补充 = 21），code 唯一", () => {
    expect(RULES.length).toBeGreaterThanOrEqual(18);
    expect(RULES.length).toBeLessThanOrEqual(23);
    expect(RULES).toHaveLength(21);
    const codes = RULES.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("规格点名的 18 条一条不少", () => {
    const codes = new Set(RULES.map((r) => r.code));
    for (const code of REQUIRED_CODES) expect(codes.has(code), `${code} 缺失`).toBe(true);
  });

  it("每条都有 label / hint / level，且 code 是 kebab-case", () => {
    for (const rule of RULES) {
      expect(rule.label.length, rule.code).toBeGreaterThan(10);
      expect(rule.hint.length, rule.code).toBeGreaterThan(8);
      expect(["block", "warn"]).toContain(rule.level);
      expect(rule.code).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("RULES_BY_CODE 与数组一致", () => {
    expect(Object.keys(RULES_BY_CODE)).toHaveLength(RULES.length);
    for (const rule of RULES) expect(RULES_BY_CODE[rule.code]).toBe(rule);
  });

  it("block 是硬约束（≥10 条）、warn 是可改进项，两类都有", () => {
    expect(RULES.filter((r) => r.level === "block").length).toBeGreaterThanOrEqual(10);
    expect(RULES.filter((r) => r.level === "warn").length).toBeGreaterThanOrEqual(5);
  });
});

describe("参考方案：21 条全过", () => {
  const report = validate(REFERENCE_PLAN);

  it("满分 100、feasible、零 issue", () => {
    expect(report.issues).toEqual([]);
    expect(report.score).toBe(MAX_SCORE);
    expect(report.feasible).toBe(true);
    expect(report.blockCount).toBe(0);
    expect(report.warnCount).toBe(0);
    expect(report.passed).toHaveLength(RULES.length);
  });

  it("byRule 每盏灯都亮", () => {
    for (const rule of RULES) expect(report.byRule[rule.code], rule.code).toBe(true);
  });
});

/** 每条规则的违规样例：只破坏这一条，其余保持满分 */
const VIOLATIONS: Array<{ code: string; level: RuleLevel; plan: PlanInput }> = [
  { code: "std-primary-standard", level: "block", plan: variant({ remove: ["piece-na2co3-primary"] }) },
  { code: "total-alkalinity-dual-indicator", level: "block", plan: variant({ params: { indicatorOrder: "reversed" } }) },
  { code: "endpoint-color-criterion", level: "warn", plan: variant({ params: { endpoint: "unspecified" } }) },
  { code: "burette-rinse", level: "block", plan: variant({ remove: ["piece-step-rinse"] }) },
  { code: "burette-degas-zero", level: "block", plan: variant({ remove: ["piece-step-degas"] }) },
  { code: "primary-standard-dried", level: "block", plan: variant({ params: { dryTemp: 200 } }) },
  { code: "analytical-balance", level: "block", plan: variant({ remove: ["piece-analytical-balance"] }) },
  { code: "parallel-min-and-range", level: "block", plan: variant({ params: { parallelCount: 1 } }) },
  { code: "conc-acid-into-water", level: "block", plan: variant({ params: { acidOrder: "water-into-acid" } }) },
  { code: "naoh-co2-free-water", level: "block", plan: variant({ remove: ["piece-boiled-water"], add: ["piece-naoh-sat", "piece-burette-base"] }) },
  { code: "no-mouth-pipetting", level: "block", plan: variant({ params: { pipetteAid: "mouth" } }) },
  { code: "flask-receiving", level: "block", plan: variant({ remove: ["piece-flask-250"] }) },
  { code: "half-drop-touch-wall", level: "warn", plan: variant({ remove: ["piece-step-half-drop"] }) },
  { code: "near-endpoint-dropwise", level: "warn", plan: variant({ remove: ["piece-step-near-endpoint"] }) },
  { code: "indicator-1-2-drops", level: "warn", plan: variant({ params: { indicatorDrops: 6 } }) },
  { code: "parallel-same-batch", level: "warn", plan: variant({ params: { sameBatch: false } }) },
  { code: "reading-two-decimals", level: "block", plan: variant({ params: { readingResolution: 0.1 } }) },
  { code: "endpoint-hold-30s", level: "warn", plan: variant({ params: { endpointHoldSec: 10 } }) },
  { code: "standardization-boil-co2", level: "block", plan: variant({ remove: ["piece-step-boil"] }) },
  { code: "blank-test", level: "warn", plan: variant({ remove: ["piece-step-blank"] }) },
  { code: "acid-base-burette-match", level: "block", plan: variant({ remove: ["piece-burette-acid"] }) },
];

describe("每条规则：通过用例", () => {
  it.each(RULES.map((r) => [r.code, r.level] as const))(
    "%s（%s）在参考方案下通过",
    (code) => {
      expect(validate(REFERENCE_PLAN).byRule[code]).toBe(true);
    },
  );
});

describe("每条规则：违反用例", () => {
  it("违规样例覆盖全部规则（不多不少）", () => {
    expect(VIOLATIONS.map((v) => v.code).sort()).toEqual(RULES.map((r) => r.code).sort());
  });

  it.each(VIOLATIONS.map((v) => [v.code, v.level, v.plan] as const))(
    "%s（%s）被单独判违规",
    (code, level, plan) => {
      const report = validate(plan);
      expect(report.byRule[code]).toBe(false);
      // 只破坏一条：其余规则仍通过，报错清单恰好一条
      expect(report.issues.map((i) => i.ruleId)).toEqual([code]);
      expect(report.issues[0].level).toBe(level);
      expect(RULES_BY_CODE[code].level).toBe(level); // 表里的级别与样例一致
    },
  );

  it.each(VIOLATIONS.map((v) => [v.code, v.plan] as const))(
    "%s 违规时 issue 带 label 与 hint 可供 UI 直接渲染",
    (code, plan) => {
      const [issue] = validate(plan).issues;
      expect(issue.text.length).toBeGreaterThan(10);
      expect(issue.hint.length).toBeGreaterThan(8);
      expect(issue.ruleId).toBe(code);
    },
  );
});

describe("评分与可行性边界", () => {
  it("全过 100；1 条 block = 88；2 条 warn = 90", () => {
    expect(validate(REFERENCE_PLAN).score).toBe(100);

    const oneBlock = validate(variant({ remove: ["piece-analytical-balance"] }));
    expect(oneBlock.score).toBe(100 - BLOCK_DEDUCT);
    expect(oneBlock.score).toBe(88);
    expect(oneBlock.feasible).toBe(false);
    expect(oneBlock.blockCount).toBe(1);

    const twoWarns = validate(variant({ params: { indicatorDrops: 6, endpointHoldSec: 10 } }));
    expect(twoWarns.score).toBe(100 - 2 * WARN_DEDUCT);
    expect(twoWarns.score).toBe(90);
    expect(twoWarns.feasible).toBe(true); // 只有 warn 仍可执行
    expect(twoWarns.warnCount).toBe(2);
  });

  it("1 block + 1 warn = 83，且 block 优先让 feasible=false", () => {
    const report = validate(
      variant({ remove: ["piece-flask-250"], params: { sameBatch: false } }),
    );
    expect(report.score).toBe(100 - BLOCK_DEDUCT - WARN_DEDUCT);
    expect(report.feasible).toBe(false);
  });

  it("最低 0：全空方案扣到 0 不为负，且 feasible=false", () => {
    const empty: PlanInput = { pieces: [], params: {} };
    const report = validate(empty);
    expect(report.score).toBe(0);
    expect(report.feasible).toBe(false);
    expect(report.blockCount).toBeGreaterThan(5);
  });

  it("参考方案少放块只会变差，不会变好（单调性抽检）", () => {
    const pieces = REFERENCE_PLAN.pieces;
    let previous = 100;
    for (let n = pieces.length; n >= pieces.length - 5; n--) {
      const report = validate({ pieces: pieces.slice(0, n), params: REFERENCE_PLAN.params });
      expect(report.score).toBeLessThanOrEqual(previous);
      previous = report.score;
    }
  });

  it("同一 plan 两次 validate 结果完全一致（纯函数）", () => {
    const a: PlanReport = validate(REFERENCE_PLAN);
    const b: PlanReport = validate(REFERENCE_PLAN);
    expect(b).toEqual(a);
  });
});

describe("API 适配（契约 §9）", () => {
  it("toApiResult 返回 { ok, score, issues[{ruleId, level, text}] }", () => {
    const report = validate(variant({ remove: ["piece-analytical-balance"] }));
    const api = toApiResult(report);
    expect(api.ok).toBe(false);
    expect(api.score).toBe(88);
    expect(api.issues).toHaveLength(1);
    expect(Object.keys(api.issues[0]).sort()).toEqual(["level", "ruleId", "text"]);
  });

  it("满分的 API 形状：ok=true、issues 空数组", () => {
    const api = toApiResult(validate(REFERENCE_PLAN));
    expect(api).toEqual({ ok: true, score: 100, issues: [] });
  });

  it("unknownPieces 只报未知块，未知块不被任何规则当作有效素材", () => {
    const withGhost = variant({ add: ["piece-ghost"] });
    expect(unknownPieces(withGhost)).toEqual(["piece-ghost"]);
    expect(validate(withGhost).score).toBe(100); // 已知块都能过，未知块不参与判定
    // 用未知块顶替真块则扣分：把分析天平换成 ghost
    const swapped = variant({ remove: ["piece-analytical-balance"], add: ["piece-ghost"] });
    expect(validate(swapped).byRule["analytical-balance"]).toBe(false);
  });
});
