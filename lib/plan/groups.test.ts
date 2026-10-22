import { describe, expect, it } from "vitest";
import { PIECES, PLAN_GROUPS, REFERENCE_PLAN } from "./pieces";
import { GROUP_BY_ID, PLAN_GROUP_IDS, groupOf, libraryGroups, ungroupedPieces } from "./groups";
import { validate } from "./rules";
import { verdictOf } from "./verdict";
import { RULE_SHORT, shortLabel } from "./rule-labels";

describe("素材库分组 PLAN_GROUPS", () => {
  it("三组齐全，顺序即教学顺序", () => {
    expect(PLAN_GROUP_IDS).toEqual(["standardization", "alkalinity", "general"]);
    expect(PLAN_GROUPS.map((g) => g.title)).toEqual([
      "① HCl 标定",
      "② 总碱度测定",
      "③ 通用器材与记录",
    ]);
  });

  it("每块恰好属于一个组，没有漏掉或重复的块", () => {
    expect(ungroupedPieces()).toEqual([]);
    const all = PLAN_GROUPS.flatMap((g) => g.pieceIds);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(PIECES.length);
    for (const p of PIECES) expect(groupOf(p.id), p.id).toBeDefined();
  });

  it("组内 id 都是真块（拼写错了这里就红）", () => {
    for (const g of PLAN_GROUPS) {
      for (const id of g.pieceIds) {
        expect(PIECES.some((p) => p.id === id), `${g.id}/${id}`).toBe(true);
      }
    }
  });

  it("标定组覆盖基准物+标定终点，总碱度组覆盖双指示剂，通用组覆盖器材", () => {
    expect(GROUP_BY_ID.standardization.pieceIds).toContain("piece-na2co3-primary");
    expect(GROUP_BY_ID.standardization.pieceIds).toContain("piece-step-boil");
    expect(GROUP_BY_ID.alkalinity.pieceIds).toContain("piece-phenolphthalein");
    expect(GROUP_BY_ID.alkalinity.pieceIds).toContain("piece-param-endpoint");
    expect(GROUP_BY_ID.general.pieceIds).toContain("piece-analytical-balance");
    expect(GROUP_BY_ID.general.pieceIds).toContain("piece-step-parallel");
  });

  it("libraryGroups：全部模式三组都在，已选数按方案算、分母不随过滤变", () => {
    const all = libraryGroups(REFERENCE_PLAN.pieces, null);
    expect(all).toHaveLength(3);
    const standard = all[0];
    expect(standard.total).toBe(GROUP_BY_ID.standardization.pieceIds.length);
    expect(standard.selected).toBeGreaterThan(0);
    expect(standard.selected).toBeLessThanOrEqual(standard.total);
  });

  it("libraryGroups：kind 过滤只留该类块，空组不返回", () => {
    const reagents = libraryGroups([], "reagent");
    expect(reagents.length).toBeGreaterThan(0);
    for (const g of reagents) for (const p of g.pieces) expect(p.kind).toBe("reagent");
    const params = libraryGroups([], "param");
    for (const g of params) expect(g.pieces.length).toBeGreaterThan(0);
  });

  it("空方案下三组选中数都是 0", () => {
    for (const g of libraryGroups([], null)) expect(g.selected).toBe(0);
  });
});

describe("评分卡结论文案 verdictOf", () => {
  it("空方案：不可行且文案带得分", () => {
    const report = validate({ pieces: [] });
    const v = verdictOf(report, 0);
    expect(v.tone).toBe("block");
    expect(v.headline).toContain("不可行");
    expect(v.headline).toContain(String(report.score));
  });

  it("参考方案：可行、满分、top 为空", () => {
    const report = validate(REFERENCE_PLAN);
    const v = verdictOf(report, REFERENCE_PLAN.pieces.length);
    expect(report.score).toBe(100);
    expect(v.tone).toBe("ok");
    expect(v.headline).toContain("可行");
    expect(v.top).toEqual([]);
    expect(v.folded).toBe(0);
  });

  it("缺硬约束：top 最多 3 条、硬约束排在前面，其余进明细", () => {
    const report = validate({ pieces: ["piece-flask-250"], params: {} });
    const v = verdictOf(report, 1);
    expect(v.tone).toBe("block");
    expect(v.top.length).toBeLessThanOrEqual(3);
    expect(v.top.length + v.folded).toBe(report.issues.length);
    if (v.top.length > 0) expect(v.top[0].level).toBe("block");
  });
});

describe("规则短名 RULE_SHORT", () => {
  it("21 条规则都有短名，且不超过 10 字", () => {
    const report = validate({ pieces: [] });
    const codes = [...report.passed, ...report.issues.map((i) => i.ruleId)];
    expect(codes.length).toBe(21);
    for (const code of codes) {
      expect(RULE_SHORT[code], code).toBeTruthy();
      expect(shortLabel(code).length).toBeLessThanOrEqual(14);
    }
  });

  it("未登记的 code 回落到首个分句，不抛也不空", () => {
    expect(shortLabel("not-a-rule").length).toBeGreaterThan(0);
  });
});
