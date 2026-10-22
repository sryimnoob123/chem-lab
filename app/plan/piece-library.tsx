/**
 * 素材库 —— 按实验阶段分三段出题（① HCl 标定 / ② 总碱度测定 / ③ 通用器材与记录）。
 *
 * 为什么改：原先按 kind（器材/试剂/步骤/参数）平铺，学生看到 32 块平权素材，
 * 不知道哪块属于哪个环节、该先想哪一步。现在分组是主结构，kind 退化为筛选。
 *
 * 分组依据只在 lib/plan/pieces.ts 的 `PLAN_GROUPS`，这里不重复任何块信息。
 * 演示脚本依赖 data-demo-id：每块仍是 `demo-design-piece-*`，类型筛选仍是 `demo-design-tab-*`。
 *
 * 拖拽（2026-10-22 全站拖拽体检）：素材可以直接拖进「我的方案」，点一下也仍然能加。
 * 拖动全程零 setState：坐标只进 ref，影子位置在 rAF 里写 transform，
 * 落点高亮只改属性，只有松手落在方案区时才调一次 onToggle —— 和 exp01 实验台同一套纪律。
 */

import { useCallback, useEffect, useRef } from "react";
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

/** 拖出这么多像素才算「拖」，否则当点击 */
const DRAG_START = 6;
/** 方案区的落点标记（designer.tsx 的「我的方案」面板） */
const DROP_TARGET = '[data-plan-drop="list"]';

type PieceDragSession = {
  id: string;
  el: HTMLButtonElement;
  x: number;
  y: number;
  moved: boolean;
  title: string;
  sub: string;
};

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
  /** 主题推荐顺序：featured 的下标就是素材库置顶顺序（也是建议拼接顺序） */
  const pinnedOrder = new Map((featured ?? []).map((id, index) => [id, index]));
  const ordered = (pieces: readonly PlanPiece[]) =>
    [...pieces].sort((a, b) => {
      const ia = pinnedOrder.get(a.id);
      const ib = pinnedOrder.get(b.id);
      if (ia === undefined && ib === undefined) return 0;
      if (ia === undefined) return 1;
      if (ib === undefined) return -1;
      return ia - ib;
    });

  const ghostRef = useRef<HTMLDivElement | null>(null);
  const ghostTitleRef = useRef<HTMLSpanElement | null>(null);
  const ghostSubRef = useRef<HTMLSpanElement | null>(null);
  const sessionRef = useRef<PieceDragSession | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);
  /** 刚拖过：吞掉紧随其后的 click（否则拖进来的又被 click 取消掉） */
  const draggedRef = useRef(false);

  const endDrag = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
    if (session) delete session.el.dataset.dragging;
    if (ghostRef.current) ghostRef.current.dataset.on = "false";
    const list = document.querySelector<HTMLElement>(DROP_TARGET);
    if (list) delete list.dataset.over;
  }, []);

  useEffect(() => endDrag, [endDrag]);

  /** 一帧一次：影子跟着指针（fixed + transform，不动 left/top） */
  const flush = useCallback(() => {
    frameRef.current = 0;
    const ghost = ghostRef.current;
    if (!ghost) return;
    ghost.style.transform = `translate3d(${pointerRef.current.x + 14}px, ${pointerRef.current.y + 10}px, 0)`;
  }, []);

  const begin = (event: React.PointerEvent<HTMLButtonElement>, piece: PlanPiece) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    sessionRef.current = {
      id: piece.id,
      el: event.currentTarget,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      title: piece.title,
      sub: piece.sub,
    };
    pointerRef.current = { x: event.clientX, y: event.clientY };
  };

  const move = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = sessionRef.current;
    if (!session) return;
    if (!session.moved) {
      if (Math.hypot(event.clientX - session.x, event.clientY - session.y) < DRAG_START) return;
      session.moved = true;
      session.el.dataset.dragging = "true";
      const ghost = ghostRef.current;
      if (ghost) {
        if (ghostTitleRef.current) ghostTitleRef.current.textContent = session.title;
        if (ghostSubRef.current) ghostSubRef.current.textContent = session.sub;
        ghost.dataset.on = "true";
      }
    }
    pointerRef.current = { x: event.clientX, y: event.clientY };
    // 落点高亮：只改属性，不 setState
    const list = document.querySelector<HTMLElement>(DROP_TARGET);
    if (list) {
      const over = Boolean(
        document.elementFromPoint(event.clientX, event.clientY)?.closest(DROP_TARGET),
      );
      if (over) list.dataset.over = "true";
      else delete list.dataset.over;
    }
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(flush);
  };

  const finish = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = sessionRef.current;
    if (!session) return;
    const overList = Boolean(
      document.elementFromPoint(event.clientX, event.clientY)?.closest(DROP_TARGET),
    );
    endDrag();
    draggedRef.current = session.moved;
    if (!session.moved) return; // 没动 = 普通点击，交给 onClick
    // 已经选中的块再拖一次不做任何事（避免「拖进方案区反而把它删了」）
    if (overList && !picked.has(session.id)) onToggle(session.id);
  };

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
                    data-featured={pinnedOrder.has(p.id) ? "true" : undefined}
                    aria-pressed={on}
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                    onPointerDown={(event) => begin(event, p)}
                    onPointerMove={move}
                    onPointerUp={finish}
                    onPointerCancel={endDrag}
                    onClick={() => {
                      // 拖动刚落下的那个 click：吞掉
                      if (draggedRef.current) {
                        draggedRef.current = false;
                        return;
                      }
                      onToggle(p.id);
                    }}
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

      {/* 拖动影子：常驻渲染、默认 display:none；出现只切 data-on，位置由 rAF 写 transform */}
      <div ref={ghostRef} className={s.dragPiece} data-on="false" aria-hidden="true">
        <span ref={ghostTitleRef} />
        <span ref={ghostSubRef} className={s.dragPieceSub} />
      </div>
    </section>
  );
}
