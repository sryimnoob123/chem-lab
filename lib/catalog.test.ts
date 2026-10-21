import { describe, expect, it } from "vitest";
import { buildGroups, GROUP_SPEC, UNLOCK_PASS_SCORE, type CatalogItem } from "./catalog";

/** 造一个完整的 CatalogItem（只关心 id 与 completed） */
function item(id: string, no: string, completed = false): CatalogItem {
  return {
    id,
    no,
    title: `实验 ${id}`,
    desc: "测试用",
    hours: 3,
    kind: "验证",
    playable: true,
    completed,
    bestScore: completed ? 80 : null,
  };
}

/** 按 GROUP_SPEC 把 10 个实验摊平，completed 由调用方指定 */
function itemsWith(completedIds: string[]): CatalogItem[] {
  return GROUP_SPEC.flatMap((g) =>
    g.ids.map((id, i) => item(id, String(i + 1).padStart(2, "0"), completedIds.includes(id))),
  );
}

const G1 = GROUP_SPEC[0].ids; // exp01 exp02 exp08
const G2 = GROUP_SPEC[1].ids; // exp03..exp07
const G3 = GROUP_SPEC[2].ids; // exp09 exp10

describe("buildGroups 分层解锁", () => {
  it("没有任何进度时只有第一档解锁", () => {
    const groups = buildGroups(itemsWith([]));
    expect(groups.map((g) => g.unlocked)).toEqual([true, false, false]);
  });

  it("第一档全部完成后解锁第二档，第三档仍锁", () => {
    const groups = buildGroups(itemsWith(G1));
    expect(groups.map((g) => g.unlocked)).toEqual([true, true, false]);
    expect(groups[0].done).toBe(G1.length);
    expect(groups[0].total).toBe(G1.length);
  });

  it("前两档全部完成后第三档解锁", () => {
    const groups = buildGroups(itemsWith([...G1, ...G2]));
    expect(groups.map((g) => g.unlocked)).toEqual([true, true, true]);
  });

  it("第一档只完成一部分时第二档仍锁，且提示里有 x/y", () => {
    const groups = buildGroups(itemsWith([G1[0]]));
    expect(groups[1].unlocked).toBe(false);
    expect(groups[1].unlockHint).toContain(`${1}/${G1.length}`);
    expect(groups[1].unlockHint).toContain(GROUP_SPEC[0].title);
  });

  it("unlockAll 打开时三档全解锁（调试/演示口子）", () => {
    const groups = buildGroups(itemsWith([]), true);
    expect(groups.every((g) => g.unlocked)).toBe(true);
    expect(groups.every((g) => g.unlockHint === "")).toBe(true);
  });

  it("已解锁的档 unlockHint 为空串", () => {
    const groups = buildGroups(itemsWith(G1));
    expect(groups[0].unlockHint).toBe("");
    expect(groups[1].unlockHint).toBe("");
    expect(groups[2].unlockHint).not.toBe("");
  });

  it("提示文案里带上及格线分数", () => {
    const groups = buildGroups(itemsWith([]));
    expect(groups[1].unlockHint).toContain(String(UNLOCK_PASS_SCORE));
  });

  it("每档 item 按编号排序", () => {
    const groups = buildGroups(itemsWith([]));
    for (const g of groups) {
      const nos = g.items.map((i) => i.no);
      expect([...nos].sort((a, b) => a.localeCompare(b)).join(",")).toBe(nos.join(","));
    }
  });

  it("三档的 total 与大纲一致（3 / 5 / 2）", () => {
    const groups = buildGroups(itemsWith([]));
    expect(groups.map((g) => g.total)).toEqual([3, 5, 2]);
  });
});
