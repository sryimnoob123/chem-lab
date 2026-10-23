"use client";

/**
 * 操作台右侧的两个小件（用户 2026-10-23）：
 *
 * 1. `TaskBoardMini` —— 学生用的迷你任务看板，接在「实时读数 / 允许误差」卡下面。
 *    只报三件事：做到第几步、这一步叫什么、判据一句话。
 *    **不下沉到子任务清单**（用户口径：任务点别说太细），细的引导留给左上引导卡。
 *
 * 2. `AiTutor` —— 右下角 AI 助教。形状/交互参照用户 2026-10-20 那个项目的 TutorPanel：
 *    悬浮入口 → 右侧全高抽屉 + 遮罩，头部是「图标 + 名字 + 在线呼吸点」，消息流带头像，
 *    底部 textarea + 圆形发送键（发送中变转圈）。
 *    差别（用户 2026-10-23）：入口只画**机器人图标**、不写「AI 助教」四个字；入口**可以拖**。
 *    现在没有大模型可接：回复固定为「还没接入」，部署到扣子后把 send() 换成真实调用即可。
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import s from "./rail-mini.module.css";

/* ─────────────────────────── 迷你任务看板 ─────────────────────────── */

export function TaskBoardMini({
  index,
  total,
  title,
  criterion,
}: {
  /** 当前步下标（0 起） */
  index: number;
  /** 总步数 */
  total: number;
  /** 这一步叫什么 */
  title: string;
  /** 判据一句话（没有就不显示，不摆一行「—」） */
  criterion?: string | null;
}) {
  const now = Math.max(0, Math.min(total, index + 1));
  return (
    <section className={s.board} data-demo-id="demo-task-board-mini" aria-label="任务进度">
      <div className={s.boardHead}>
        <span className={s.boardLabel}>任务</span>
        <span className={s.boardCount}>
          {now} / {total}
        </span>
      </div>
      <ol className={s.dots} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <li key={i} data-state={i + 1 < now ? "done" : i + 1 === now ? "now" : "todo"} />
        ))}
      </ol>
      <p className={s.boardTitle}>{title}</p>
      {criterion ? <p className={s.boardCriterion}>{criterion}</p> : null}
    </section>
  );
}

/* ────────────────────────────── AI 助教 ────────────────────────────── */

type Message = { id: number; from: "me" | "ai"; text: string };
type Point = { x: number; y: number };

const INTRO = "助教还在接入大模型（部署到扣子后开放）。现在可以先看任务看板的判据，答不上来的点「提示」。";
const OFFLINE = (step: string) =>
  `还没接上大模型，我只能说到这里：现在这步是「${step}」。具体做法用右侧「看原因 / 提示」。`;

/** 没有 LLM 时也让人看得懂：三个常见问法直接列出来，点了给同一句实话。 */
const QUICK = ["这一步要注意什么？", "我为什么会扣分？", "怎么读出正确数值？"];

/** 机器人头像：方脑袋 + 天线 + 两只眼睛，用图形代表助教身份。 */
function RobotIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M16 3.6v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="3" r="1.5" fill="currentColor" />
      <rect x="5.6" y="8" width="20.8" height="16" rx="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="15" r="1.9" fill="currentColor" />
      <circle cx="20" cy="15" r="1.9" fill="currentColor" />
      <path d="M12.5 20h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M2.9 14v4M29.1 14v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const DRAG_THRESHOLD = 4;
const BUTTON_SIZE = 54;
/** 与实验台保持的净空：按钮/对话框都不许压到台面上。 */
const BENCH_MARGIN = 10;

/**
 * 实验台的**真实绘制框**：页面里最大的那个场景 SVG（viewBox 370 138 780 410 那台）。
 * 拿不到就退回 [data-scene] 的矩形，再拿不到返回 null（此时不限制）。
 * 为什么要量它而不是 [data-scene]：那个容器是整页宽的，拿它当禁区等于「哪都不许放」。
 */
function benchRect(): DOMRect | null {
  const scene = document.querySelector("[data-scene]");
  const scope: ParentNode = scene ?? document;
  let best: DOMRect | null = null;
  for (const svg of scope.querySelectorAll("svg")) {
    const r = svg.getBoundingClientRect();
    if (r.width < 200 || r.height < 120) continue;
    if (!best || r.width * r.height > best.width * best.height) best = r;
  }
  if (best) return best;
  return scene ? scene.getBoundingClientRect() : null;
}

/** 把矩形推离实验台：只沿穿透最浅的一边推出去，手感是「绕着台边走」。 */
function pushOutsideBench(x: number, y: number, w: number, h: number): { x: number; y: number } {
  const b = benchRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let nx = Math.min(vw - w - 8, Math.max(8, x));
  let ny = Math.min(vh - h - 8, Math.max(8, y));
  if (!b) return { x: nx, y: ny };
  const hit =
    nx + w > b.left - BENCH_MARGIN &&
    nx < b.right + BENCH_MARGIN &&
    ny + h > b.top - BENCH_MARGIN &&
    ny < b.bottom + BENCH_MARGIN;
  if (!hit) return { x: nx, y: ny };
  const pushLeft = Math.abs(nx + w - (b.left - BENCH_MARGIN));
  const pushRight = Math.abs(b.right + BENCH_MARGIN - nx);
  const pushUp = Math.abs(ny + h - (b.top - BENCH_MARGIN));
  const pushDown = Math.abs(b.bottom + BENCH_MARGIN - ny);
  const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
  if (min === pushLeft) nx = b.left - BENCH_MARGIN - w;
  else if (min === pushRight) nx = b.right + BENCH_MARGIN;
  else if (min === pushUp) ny = b.top - BENCH_MARGIN - h;
  else ny = b.bottom + BENCH_MARGIN;
  return {
    x: Math.min(vw - w - 8, Math.max(8, nx)),
    y: Math.min(vh - h - 8, Math.max(8, ny)),
  };
}

export function AiTutor({ stepTitle }: { stepTitle: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: "ai", text: INTRO }]);
  /** 拖动后的落点；null = 默认停在右下角（CSS 管） */
  const [pos, setPos] = useState<Point | null>(null);
  /** portal 只在客户端挂载后渲染：用 useSyncExternalStore 取「是否客户端」，避免 effect 里 setState */
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const listRef = useRef<HTMLDivElement | null>(null);
  const seqRef = useRef(1);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, open, busy]);

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setMessages((prev) => [...prev, { id: seqRef.current++, from: "me", text: clean }]);
    setDraft("");
    setBusy(true);
    // 假延迟 380ms：接真接口时把这里换成 fetch / 流式读取，界面不动。
    window.setTimeout(() => {
      setMessages((prev) => [...prev, { id: seqRef.current++, from: "ai", text: OFFLINE(stepTitle) }]);
      setBusy(false);
    }, 380);
  };

  /**
   * 拖动：按下只记起点，move 里直接写 style（每帧不 setState），松手才落状态。
   * 位移 < 4px 当作点击（开抽屉），超过才算拖 —— 和实验台拖拽同一套判据。
   */
  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY };
    const origin = { x: rect.left, y: rect.top };
    let moved = false;

    const onMove = (move: PointerEvent) => {
      const dx = move.clientX - start.x;
      const dy = move.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      moved = true;
      // 只许在实验台外面转：进台面的位置会被推到最近的那条边上
      const next = pushOutsideBench(origin.x + dx, origin.y + dy, BUTTON_SIZE, BUTTON_SIZE);
      el.style.left = `${next.x}px`;
      el.style.top = `${next.y}px`;
      el.style.right = "auto";
      el.style.bottom = "auto";
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (moved) {
        const box = el.getBoundingClientRect();
        setPos({ x: box.left, y: box.top });
      } else {
        setOpen(true);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  if (!mounted) return null;

  const buttonStyle: React.CSSProperties | undefined = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : undefined;

  /**
   * 小对话框的位置：**贴在实验台外面**的那条空带里（右侧栏上方 / 台面下沿右边），
   * 宽度跟着空带收（220~300），高度不超过 340。窗口太小退回右下角。
   */
  const dialogStyle = (): React.CSSProperties => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bench = benchRect();
    // 右栏那条空带只有 ~250px：优先贴着台外放，放不下再收到 220（CSS 已能收窄不溢出）
    const width = bench ? Math.min(320, Math.max(220, vw - bench.right - 12)) : 300;
    const height = Math.min(420, vh - 110);
    const anchorY = pos ? pos.y : vh - 18 - BUTTON_SIZE;
    let x = vw - width - 12;
    if (bench) x = Math.max(bench.right + BENCH_MARGIN, Math.min(x, vw - width - 12));
    let y = Math.min(vh - height - 12, Math.max(12, anchorY + BUTTON_SIZE - height));
    if (bench && x < bench.right + BENCH_MARGIN && y + height > bench.top && y < bench.bottom) {
      y = Math.max(12, bench.top - BENCH_MARGIN - height);
    }
    return { left: x, top: y, width, height };
  };

  const floating = (
    <>
      {open ? (
        <section
          className={s.dialog}
          style={dialogStyle()}
          role="dialog"
          aria-label="助教对话"
          data-demo-id="demo-ai-chat"
        >
            <header className={s.drawerHead}>
              <span className={s.headIcon} aria-hidden="true">
                <RobotIcon size={20} />
              </span>
              <div className={s.headText}>
                <p className={s.headTitle}>助教</p>
                <p className={s.headState} data-demo-id="demo-ai-state">
                  <span className={s.dot} data-on={busy ? "busy" : "idle"} aria-hidden="true" />
                  {busy ? "正在输入…" : "未接入 · 部署后开放"}
                </p>
              </div>
              <button
                type="button"
                className={s.close}
                aria-label="收起对话框"
                data-demo-id="demo-ai-close"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </header>

            <div className={s.stream} ref={listRef} data-demo-id="demo-ai-messages">
              {messages.map((m) => (
                <div key={m.id} className={s.row} data-from={m.from}>
                  {m.from === "ai" ? (
                    <span className={s.rowAvatar} aria-hidden="true">
                      <RobotIcon size={13} />
                    </span>
                  ) : null}
                  <p className={s.bubble} data-from={m.from}>
                    {m.text}
                  </p>
                </div>
              ))}
              {busy ? (
                <div className={s.row} data-from="ai">
                  <span className={s.rowAvatar} aria-hidden="true">
                    <RobotIcon size={13} />
                  </span>
                  <p className={s.bubble} data-from="ai" data-typing="true">
                    正在输入…
                  </p>
                </div>
              ) : null}
            </div>

            {messages.length === 1 ? (
              <div className={s.quick}>
                {QUICK.map((q) => (
                  <button key={q} type="button" className={s.quickChip} onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
              </div>
            ) : null}

            <div className={s.composer}>
              <textarea
                className={s.input}
                value={draft}
                rows={2}
                placeholder="问这一步怎么做（Enter 发送）"
                aria-label="对助教说"
                data-demo-id="demo-ai-input"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send(draft);
                  }
                }}
              />
              <button
                type="button"
                className={s.send}
                disabled={!draft.trim() || busy}
                aria-label="发送"
                data-demo-id="demo-ai-send"
                onClick={() => send(draft)}
              >
                {busy ? <span className={s.spinner} aria-hidden="true" /> : "↑"}
              </button>
            </div>
          </section>
      ) : null}

      <button
        type="button"
        className={s.fab}
        style={buttonStyle}
        data-demo-id="demo-ai-button"
        aria-label="呼叫助教"
        title="呼叫助教"
        onPointerDown={onPointerDown}
      >
        <RobotIcon size={26} />
        <span className={s.fabDot} aria-hidden="true" />
      </button>
    </>
  );

  return createPortal(floating, document.body);
}
