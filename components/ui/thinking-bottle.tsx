"use client";

import s from "./thinking-bottle.module.css";

/**
 * 「正在处理」指示器：一个静止的试剂瓶 + 液面小气泡上升。
 *
 * 为什么不用通用三点跳动（用户 2026-10-23 定的）：化学台的等待态要有学科味道。
 * 为什么不做「倒液」动作：倾倒 = 正在执行操作，语义会误导（学生以为方案在被执行）；
 * 静止瓶 + 气泡 = 正在思考/处理，语义对得上，也不躁。
 *
 * 动效规范（AGENTS.md §3.1）：只动 transform / opacity，周期 2s，linear 匀速（气泡物理上就该匀速），
 * `prefers-reduced-motion` 下退化成静态液面（信息不丢，因为旁边的文案已经说了「评测中」）。
 */
export function ThinkingBottle({ size = 22 }: { size?: number }) {
  return (
    <svg
      className={s.bottle}
      width={size}
      height={size * 1.28}
      viewBox="0 0 24 31"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* 瓶盖 */}
      <rect x="9" y="1.2" width="6" height="3.2" rx="1" className={s.cap} />
      {/* 瓶颈 */}
      <path d="M10.4 4.4h3.2v3.6h-3.2z" className={s.neck} />
      {/* 瓶身 */}
      <rect x="3.6" y="8" width="16.8" height="21.2" rx="3.2" className={s.body} />
      {/* 液体：底部的圆角块 */}
      <path d="M5.4 20.2h13.2v6.2a2.2 2.2 0 0 1-2.2 2.2H7.6a2.2 2.2 0 0 1-2.2-2.2z" className={s.liquid} />
      {/* 液面 */}
      <line x1="5.4" y1="20.2" x2="18.6" y2="20.2" className={s.surface} />
      {/* 气泡：三颗错开上升 */}
      <circle cx="9" cy="25.6" r="1.05" className={s.bubble} />
      <circle cx="13.2" cy="26.4" r="0.8" className={s.bubble} />
      <circle cx="11.2" cy="24.6" r="0.65" className={s.bubble} />
    </svg>
  );
}
