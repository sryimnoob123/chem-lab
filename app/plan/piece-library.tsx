/**
 * 素材库 —— 按实验阶段分三段出题（① HCl 标定 / ② 总碱度测定 / ③ 通用器材与记录）。
 *
 * 为什么改：原先按 kind（器材/试剂/步骤/参数）平铺，学生看到 32 块平权素材，
 * 不知道哪块属于哪个环节、该先想哪一步。现在分组是主结构，kind 退化为筛选。
 *
 * 分组依据只在 lib/plan/pieces.ts 的 `PLAN_GROUPS`，这里不重复任何块信息。
 * 演示脚本依赖 data-demo-id：每块仍是 `demo-design-piece-*`，类型筛选仍是 `demo-design-tab-*`。
 */

import { PIECES, type PieceKind, type PlanPiece } from "@/lib/plan/pieces";
import { libraryGroups } from "@/lib/plan/groups";
import s from "./plan.module.css";

const KIND_LABEL: Record<PieceKind, string> = {
  apparatus: "器材",
  reagent: "试剂",
  step: "步骤",
  param: "参数",
};

const KIND_ORDER: readonly PieceKind[] = ["apparatus", "reagent", "step", "param"];

export function PieceLibrary({
  selected,
  kind,
  onKind,
  onToggle,
  featured,
}: {
  selected: readonly string[];
  kind: PieceKind | null;
  onKind: (kind: PieceKind | null) => void;
  onToggle: (id: string) => void;
  /** 主题推荐素材：置顶显示（其余仍可选，用来做错） */
  featured?: readonly string[];
}) {
  const groups = libraryGroups(selected, kind);
  const picked = new Set(selected);
  const pinned = new Set(featured ?? []);
  /** 主题相关块排到本组最前：学生先看见该主题用得上的，再看见全量 */
  const ordered = (pieces: readonly PlanPiece[]) =>
    [...pieces].sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)));

  return (
    <section className={s.panel} aria-label="素材库">
      <div className={s.panelHead}>
        <h2 className={s.panelTitle}>素材库</h2>
        <span className={s.mono}>
          {selected.length} / {PIECES.length} 已选
        </span>
      </div>

      <div className={s.kinds} role="group" aria-label="按类型筛选">
        <button
          type="button"
          className={s.kind}
          aria-pressed={kind === null}
          onClick={() => onKind(null)}
        >
          全部
        </button>
        {KIND_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            className={s.kind}
            data-demo-id={`demo-design-tab-${k}`}
            aria-pressed={kind === k}
            onClick={() => onKind(kind === k ? null : k)}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div className={s.groups}>
        {groups.map(({ group, pieces, selected: sel, total }) => (
          <section key={group.id} className={s.group} data-demo-id={`demo-design-group-${group.id}`}>
            <header className={s.groupHead}>
              <h3 className={s.groupTitle}>{group.title}</h3>
              <span className={s.groupCount} data-on={sel > 0}>
                {sel} / {total}
              </span>
            </header>
            <div className={s.pieceList}>
              {ordered(pieces).map((p) => {
                const on = picked.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={s.piece}
                    data-demo-id={p.demoId}
                    data-featured={pinned.has(p.id) ? "true" : undefined}
                    aria-pressed={on}
                    onClick={() => onToggle(p.id)}
                  >
                    <span className={s.pieceTitle}>
                      {p.title}
                      {on ? (
                        <span className={s.tick} aria-hidden="true">
                          ✓
                        </span>
                      ) : null}
                    </span>
                    <span className={s.pieceSub}>{p.sub}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
