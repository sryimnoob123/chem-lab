# 交接 · webapp（2026-10-22 夜 · exp01 实验台）

## 状态
exp01 拖拽/台面/动作层已做完并实测到报告页；改动**未提交**（工作区里另有上一轮遗留的学院改名）。

## 本轮改动（文件）
- `components/exp/scene/use-bench-drag.ts`（新）：指针拖拽底层，零 setState、rAF 一帧一次、pointer capture、拿起态、380ms 回弹。
- `components/exp/scene/bench-scene.tsx`：范围改实时 viewBox（整块台面）；落槽原地洗、落台面留位、落台外回弹；台面三层视觉 + 网格 + 前沿；器皿归位防打断（resettingRef）。
- `components/exp/scene/{tool-tray,sink}.tsx` · `vessels/glass-vessel.tsx` · `scene.module.css` · `globals.css`：托盘/洗槽/接地影/烧杯刻度 + 新 token（--bench-top/--bench-edge/--sink-basin…）。
- `app/exp/[id]/{workbench,scene-stage}.tsx`：动作播报文案、点空白提示按动作类型、转移 from 顺序修、试剂只对加液类步骤生效、keydown target 兜底、删旧引导弹窗。

## 可复用 API（后面 9 个实验直接用）
- `useBenchDrag({svgRef,bounds,onDrop,onDragged})` → `begin(pointerEvent,id,offset)`
- `ActionLayer` / `for-choice.actionForChoice(choice,{vesselId,tool,from})`：定义只写 type，动画由底层播
- `howToFor(type)`（scene-stage）· `ACTION_CAPTION`（workbench）

## 证据
- `npx tsc --noEmit` 0 error；`npx vitest run` 547 passed；lint 只剩既有 .mjs warning
- 截图 `C:\Users\14681\AppData\Local\Temp\chemlab-shots\{01-bench,02-vessel-lifted,03-rinse-action,05-stir-action}.png`
- 全流程 1→7 → 交卷 → 报告 86/100、7/7 步、0 事故、console 0 error；拖拽跟手偏差 0.0px

## 待办
1. 视觉仍离 `preview/drag-pour.html` 有距离：器皿比例、倾倒瓶口朝向未重做。
2. 引导系统（拖尾光带 + 虚拟手指）未做；现在靠目标环 + 「现在该做」+ 动作播报。
3. 转移动画只在 from≠to 播；第 6 步点自己那台没有动画（步骤照常完成）。
4. 部署：tag `pre-deploy` 是旧版；本轮改动要上线需先提交 + push（`git -c http.proxy=http://127.0.0.1:7897 push origin main`）。

## 环境
- dev：`npm run dev`（3000）；交互验证必须用 browser_exec（Playwright headless 访问 localhost 不 hydration）。

