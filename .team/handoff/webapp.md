# 交接 · webapp（2026-10-22 深夜 · 拖拽/动画性能）

## 状态
全站拖拽热路径已体检并改完，实测与回归全绿，已提交并推 main（见 `.team/notes/webapp.md` 同日条目）。

## 本轮改动（文件）
- `components/exp/scene/scene.module.css`：拖动期间 `transition:none` + `will-change`；删器皿过渡里的 filter。
- `app/styles/motion.css`：`.ix` 去掉常驻 will-change，只在 `[data-dragging]` 时加。
- `components/exp/scene/tool-tray.tsx`：拖工具改 ref + rAF + dataset，移动期间 0 setState。
- `components/exp/scene/use-bench-drag.ts`：落点矩形快照（不再每帧 elementsFromPoint）+ hover 只在变化时写。
- `components/exp/scene/bench-scene.tsx`：按下态改 dataset 直写（不再整块重渲染）。
- `app/exp/[id]/scene-stage.tsx`：落点快照 + rAF 合并 hover + 影子常驻隐藏 + 吞掉补发 click + 用坐标判拖动（不用 movementX）+ 补 endDrag。
- `app/plan/{piece-library.tsx,designer.tsx,plan.module.css}`：素材可拖进「我的方案」（零 setState）。
- `evidence/perf-samples.json` / `perf-timeline.html` / `perf-timeline.png`：原始帧样本与出图。

## 实测口径（照抄可用）
- 帧时长 = rAF 间隔（headless 无 vsync，≈180fps，空闲 p95 6.3ms）；拖动 p95 6.2ms = 无成本。
- 跟手 = 拖动中 `getComputedStyle(el).transition === 'none'` + transform 由 rAF 一帧一写。
- React commit 用假 `__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot` 计数（prod 构建没有该钩子）。

## 待办
1. 按下那一次渲染（试剂 = setSelectedId + beginDrag）仍是唯一尖峰，prod <30ms，想再压就把 draggingId 改属性直写。
2. `components/exp/scene/reagent-rack.tsx`（旧 HTML5 拖拽）只剩预览页用，`onDragOver` 里还在 setHoverId。
3. 拼接页拖拽在触屏上是淡的（未设 touch-action），桌面演示够用。

## 环境
- dev：`npm run dev`（3000）；prod 本地：`node .next/standalone/server.js`（先 `npm run build` + 复制 `.next/static`、`public`）。
- 交互验证必须用 browser_exec（Playwright headless 访问 localhost 不 hydration）。
