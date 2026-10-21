# positive-feedback（正反馈组件库）notes

## 2026-10-21 17:22 · 完成：components/exp/feedback/ 五件套 + index + CSS，tsc/lint 全绿
- 做了什么：按 STYLE-20261021 §3.2 新建正反馈组件库（未接线，Lead 统一接）：
  - `use-reduced-motion.ts`：`useSyncExternalStore` 版 hook，SSR 返回 false、模块顶层不碰 window、effect 内不同步 setState（对齐 `components/motion/reveal.tsx` 的 lint 口径）。
  - `SuccessBurst`：8~12 段 jade 短线刻度环，`opacity+scale`，360ms（`var(--pulse)`），`replayKey` 只重播环、不重挂子结构；减动效时保留静态刻度环。
  - `ScoreOdometer`：rAF ease-out 滚数，默认 800ms（`--fb-odometer`），tabular-nums，IntersectionObserver 进视口一次；`value` 后续变化从当前值续滚；减动效直接渲染终值；动画数字 `aria-hidden` + 常驻 sr-only 终值（信息不丢）。
  - `StreakPill`：`count < 2` 返回 null；外层 pill 常驻、内层按 count 换 key 重播 `.ix-pop` 180ms（不闪）；减动效由 motion.css 静音。
  - `EndingFlash`：`brightness(1→1.06→1)` 700ms + accent 淡入淡出 600ms（`var(--tint)`，只动 opacity 的 wash 层）；tone ok=jade / endpoint=酚酞粉；减动效改为静态 accent 内描边。
  - `feedback.module.css`：组件级 `--fb-*` 变量，全部色值/时长引用 globals.css + motion.css token；无循环、无 `transition: all`、无 `:root`。
- 证据：`npx tsc --noEmit` → exit 0；`npm run lint` → `✖ 9 problems (0 errors, 9 warnings)`，9 条全部是仓库既有文件的历史 warning，feedback 目录 0 问题。
- 改了哪些文件（全部新增，均在 write scope `components/exp/feedback/`）：
  `use-reduced-motion.ts` / `SuccessBurst.tsx` / `ScoreOdometer.tsx` / `StreakPill.tsx` / `EndingFlash.tsx` / `feedback.module.css` / `index.ts`
- 下一步 / 阻塞：无阻塞。Lead 结算接线（结果条 L1、步骤完成 L2、交卷 L3）；按 handoff 的 props 直接接，无需改组件。
