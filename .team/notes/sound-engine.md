# sound-engine notes（音效引擎 · task-5）

## 2026-10-21 17:22 · 完成：音效语义表 + Web Audio 合成引擎
- 做了什么：新建 `lib/audio/kinds.ts`（8 条音效纯数据表 + 语义域 + 参数边界常量）与 `lib/audio/timing.ts`（包络/排期/总时长纯逻辑）、`lib/audio/preference.ts`（静音状态 + localStorage 记忆 + 订阅）、`lib/audio/engine.ts`（懒加载 AudioContext、playSound、主增益 0.08、页面隐藏 suspend、SSR/不支持静默降级）。
- 证据：`npx vitest run lib/audio` → 2 files / 28 tests passed。
- 改了哪些文件：lib/audio/kinds.ts、lib/audio/timing.ts、lib/audio/preference.ts、lib/audio/engine.ts、lib/audio/kinds.test.ts、lib/audio/engine.test.ts。
- 下一步 / 阻塞：无。engine.ts 首版 313 行超限，已按"时序/偏好/合成"拆成 3 个文件（当前最大 204 行）。

## 2026-10-21 17:24 · 完成：静音开关组件 + 全量验收
- 做了什么：`components/audio/sound-toggle.tsx`（`useSyncExternalStore` 订阅静音态、`aria-pressed`、原生 button 键盘可达、44×44 触控区、data-demo-id=demo-sound-toggle、开启时播 tick 自检）+ `sound-toggle.module.css`（只用 motion.css token、`prefers-reduced-motion` 降级）。补 `lib/audio/engine.test.ts`（包络单调性、排期、时长上限、静音读写兜底、SSR 降级）。
- 证据：
  - `npx tsc --noEmit` → 0（exit 0）
  - `npm run lint` → 0 error / 9 warning（全是既有文件，lib/audio 与 components/audio 单独跑 exit 0）
  - `npx vitest run` → 27 files / 444 tests passed（原基线 416 未退化，新增 28 条）
  - 行数：kinds 204 / engine 192 / timing 76 / preference 63 / 两个测试 139+177 / 组件 64 / css 63（全部 ≤300）
- 改了哪些文件：components/audio/sound-toggle.tsx、components/audio/sound-toggle.module.css。
- 下一步 / 阻塞：等 Lead 在实验页/结果页接线（接口见 .team/handoff/sound-engine.md）。
