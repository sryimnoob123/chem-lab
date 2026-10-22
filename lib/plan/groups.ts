/**
 * 素材库分组视图 —— 把 `PLAN_GROUPS` 的 id 映射翻译成可渲染的分节。
 *
 * 分组依据只有一处（pieces.ts 的 `PLAN_GROUPS`），这里只做派生：
 * 组内按映射顺序取块、按 kind 过滤、统计每组已选数；不复制任何块信息。
 * 过滤后为空的组不返回 —— 标题下面留一片空白比不显示更让人迷惑。
 */

import {
  PIECES_BY_ID,
  PLAN_GROUPS,
  type PieceKind,
  type PlanGroup,
  type PlanGroupId,
  type PlanPiece,
} from "./pieces";

export const PLAN_GROUP_IDS: readonly PlanGroupId[] = PLAN_GROUPS.map((g) => g.id);

export const GROUP_BY_ID: Readonly<Record<string, PlanGroup>> = Object.freeze(
  Object.fromEntries(PLAN_GROUPS.map((g) => [g.id, g])),
);

/** 一块所属的组；映射漏了这块就返回 undefined（`ungroupedPieces()` 会抓出来） */
export function groupOf(pieceId: string): PlanGroupId | undefined {
  for (const g of PLAN_GROUPS) {
    if (g.pieceIds.includes(pieceId)) return g.id;
  }
  return undefined;
}

export interface LibraryGroup {
  group: PlanGroup;
  /** 该组在当前 kind 过滤下要显示的块 */
  pieces: PlanPiece[];
  /** 该组已选块数（含被过滤掉的，`已选` 说的是方案不是视图） */
  selected: number;
  /** 该组块总数（不随过滤变化，分母要稳） */
  total: number;
}

/**
 * 素材库渲染用的分节。
 * @param selected 已放入方案的块 id
 * @param kind     类型过滤；`null` 表示全部
 */
export function libraryGroups(
  selected: readonly string[],
  kind: PieceKind | null = null,
): LibraryGroup[] {
  const picked = new Set(selected);
  const out: LibraryGroup[] = [];
  for (const group of PLAN_GROUPS) {
    const all = group.pieceIds
      .map((id) => PIECES_BY_ID[id])
      .filter((p): p is PlanPiece => p !== undefined);
    const shown = kind ? all.filter((p) => p.kind === kind) : all;
    if (shown.length === 0) continue;
    out.push({
      group,
      pieces: shown,
      selected: all.filter((p) => picked.has(p.id)).length,
      total: all.length,
    });
  }
  return out;
}

/** 没被任何组覆盖的块 id —— 单测与 UI 兜底断言用，正常应为空数组 */
export function ungroupedPieces(): string[] {
  const covered = new Set(PLAN_GROUPS.flatMap((g) => g.pieceIds));
  return Object.keys(PIECES_BY_ID).filter((id) => !covered.has(id));
}
