import { describe, expect, it } from "vitest";
import {
  PIECES,
  PIECES_BY_ID,
  PIECE_KINDS,
  REFERENCE_PLAN,
  getPiece,
  hasPiece,
  piecesByKind,
  type PieceKind,
} from "./pieces";
import { unknownPieces } from "./rules";

const MIN_BY_KIND: Record<PieceKind, number> = {
  apparatus: 7,
  reagent: 6,
  step: 9,
  param: 4,
};

describe("素材块库 pieces", () => {
  it("总数 ≥26，且四类都达到下限（器材≥7 / 试剂≥6 / 步骤≥9 / 参数≥4）", () => {
    expect(PIECES.length).toBeGreaterThanOrEqual(26);
    for (const kind of PIECE_KINDS) {
      expect(piecesByKind(kind).length, `${kind} 数量不足`).toBeGreaterThanOrEqual(MIN_BY_KIND[kind]);
    }
  });

  it("四类都有块，kind 只能是这四种", () => {
    const kinds = new Set(PIECES.map((p) => p.kind));
    expect([...kinds].sort()).toEqual([...PIECE_KINDS].sort());
    for (const p of PIECES) expect(PIECE_KINDS).toContain(p.kind);
  });

  it("id 唯一且形如 piece-<slug>；demoId 唯一且形如 demo-design-piece-<slug>", () => {
    const ids = PIECES.map((p) => p.id);
    const demoIds = PIECES.map((p) => p.demoId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(demoIds).size).toBe(demoIds.length);
    for (const p of PIECES) {
      expect(p.id).toMatch(/^piece-[a-z0-9-]+$/);
      expect(p.demoId).toMatch(/^demo-design-piece-[a-z0-9-]+$/);
    }
  });

  it("每块都有 title、sub、tags，标题不重复", () => {
    for (const p of PIECES) {
      expect(p.title.length, p.id).toBeGreaterThan(1);
      expect(p.sub.length, p.id).toBeGreaterThan(4);
      expect(p.tags.length, p.id).toBeGreaterThan(0);
    }
    const titles = PIECES.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("getPiece / hasPiece / PIECES_BY_ID 与数组一致，未知 id 安全返回", () => {
    for (const p of PIECES) {
      expect(getPiece(p.id)).toBe(p);
      expect(PIECES_BY_ID[p.id]).toBe(p);
    }
    expect(hasPiece(REFERENCE_PLAN, "piece-na2co3-primary")).toBe(true);
    expect(hasPiece(REFERENCE_PLAN, "piece-khp")).toBe(false);
    expect(getPiece("piece-not-exist")).toBeUndefined();
    expect(unknownPieces({ pieces: ["piece-nope"] })).toEqual(["piece-nope"]);
  });

  it("参考方案引用的块全部存在（无拼写错误），且覆盖四类", () => {
    expect(unknownPieces(REFERENCE_PLAN)).toEqual([]);
    const kinds = new Set(REFERENCE_PLAN.pieces.map((id) => getPiece(id)?.kind));
    for (const kind of PIECE_KINDS) expect(kinds).toContain(kind);
  });

  it("参考方案参数齐全：浓度/称样量/终点/平行/干燥五类参数块都在", () => {
    for (const id of [
      "piece-param-conc",
      "piece-param-sample",
      "piece-param-endpoint",
      "piece-param-parallel",
      "piece-param-drying",
    ]) {
      expect(hasPiece(REFERENCE_PLAN, id), id).toBe(true);
    }
  });
});
