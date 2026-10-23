import { describe, expect, it } from "vitest";
import { PLAN_TOPICS } from "./topics";
import { PIECES } from "./pieces";
import { buildDecomposePrompt, parseDecompose, phaseTitles, templatePhases } from "./decompose";

/**
 * 主题拆解（2026-10-24）的守卫
 *
 * 三条硬要求，改代码时不许破：
 *   ① 拆得粗 —— 4 段左右，不是块数那么多段；
 *   ② 不丢块 —— 无主题时 32 块全覆盖，每块只出现在一段里（分到两段学生会挑重）；
 *   ③ 模型输出不可信时整份丢弃，绝不半截替换（半截错标题比模板更糟）。
 */
describe("templatePhases", () => {
  const phases = templatePhases();

  it("拆粗：分段数在 3~6 之间", () => {
    expect(phases.length).toBeGreaterThanOrEqual(3);
    expect(phases.length).toBeLessThanOrEqual(6);
  });

  it("32 块全覆盖，且每块只属于一段", () => {
    const all = phases.flatMap((phase) => phase.pieceIds);
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(all)).toEqual(new Set(PIECES.map((piece) => piece.id)));
  });

  it("每段都有标题、要点、至少 2 块", () => {
    for (const phase of phases) {
      expect(phase.title.length).toBeGreaterThan(0);
      expect(phase.note.length).toBeGreaterThan(0);
      expect(phase.pieceIds.length).toBeGreaterThanOrEqual(2);
      expect(phaseTitles(phase).every((title) => title.length > 0)).toBe(true);
    }
  });

  it("按主题过滤：只留 featured 里的块，空段整段不收", () => {
    const topic = PLAN_TOPICS[0];
    const filtered = templatePhases(topic);
    const featured = new Set(topic.featured);
    const all = filtered.flatMap((phase) => phase.pieceIds);
    expect(all.every((id) => featured.has(id))).toBe(true);
    expect(filtered.every((phase) => phase.pieceIds.length > 0)).toBe(true);
  });
});

describe("parseDecompose", () => {
  const fallback = templatePhases();

  const ok = JSON.stringify({
    phases: fallback.map((phase, index) => ({ id: phase.id, title: `第${index + 1}段`, note: "一句要点" })),
  });

  it("合法输出：只换标题与要点，块归属不动", () => {
    const parsed = parseDecompose(ok, fallback);
    expect(parsed).not.toBeNull();
    expect(parsed!.map((p) => p.title)).toEqual(fallback.map((_, i) => `第${i + 1}段`));
    expect(parsed!.map((p) => p.pieceIds)).toEqual(fallback.map((p) => p.pieceIds));
  });

  it("包了 ```json 代码块也能解", () => {
    expect(parseDecompose("```json\n" + ok + "\n```", fallback)).not.toBeNull();
  });

  it("段数不对 / 缺字段 / 标题过长：整份丢弃（回落模板）", () => {
    expect(parseDecompose(JSON.stringify({ phases: [{ id: "x", title: "只有一段", note: "n" }] }), fallback)).toBeNull();
    expect(parseDecompose(JSON.stringify({ phases: fallback.map(() => ({ title: "", note: "" })) }), fallback)).toBeNull();
    expect(
      parseDecompose(
        JSON.stringify({
          phases: fallback.map(() => ({ title: "这个标题明显超过了十四个字的硬上限", note: "n" })),
        }),
        fallback,
      ),
    ).toBeNull();
    expect(parseDecompose("完全不是 JSON", fallback)).toBeNull();
  });
});

describe("buildDecomposePrompt", () => {
  it("提示词把「段数不变、不要写步骤」写死，并给出 JSON 形状", () => {
    const topic = PLAN_TOPICS[0];
    const prompt = buildDecomposePrompt(topic, templatePhases(topic));
    expect(prompt).toContain("段数不变");
    expect(prompt).toContain("不要写具体操作步骤");
    expect(prompt).toContain('"phases"');
    expect(prompt).toContain(topic.title);
  });
});
