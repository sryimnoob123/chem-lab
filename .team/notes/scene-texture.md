# scene-texture notes（实验台 2.5D 质感 · 改派轨道）

## 2026-10-22 04:20 · 完成：玻璃器皿三层质感 + 液体纵深/气泡 + 每实验主色
- 做了什么：
  - 新建 `components/exp/scene/vessels/`：`vessel-geometry.ts`（路径/液面/反光弧/高光/刻度）、`glass-vessel.tsx`（三层玻璃 + 液体 + 5 颗常驻气泡）、`outcome-fx.tsx`（沉淀/冒泡/放热/雾气，颜色改 token）、`vessel.module.css`、`index.tsx`（VesselArt 合成 + 变色终态色透传）、`render.test.ts`（SSR 结构冒烟 6 条）。
  - `components/exp/scene/vessel-art.tsx` 缩成 5 行兼容层（bench-scene 调用点不动）。
  - `lib/scene/vessel-paint.ts` + `.test.ts`：常驻气泡计划（5 颗、周期 6~9s、固定种子伪随机，SSR 一致）。
  - `app/globals.css`：新增玻璃 token（`--glass-fill/-fill-deep/-outline/-inner/-reflect/-shadow`、`--liquid-sheen/-depth`）与 `--exp-accent-01/03/09` + `[data-exp]` 作用域。
  - `app/exp/[id]/page.tsx`：BopbpsGate 内包 `<div data-exp={id} style={{display:"contents"}}>`（不产生盒子，不动布局/热区），供全页继承 --exp-accent。
  - `components/exp/guide/mission-board.module.css`：expNo 颜色 / goal 左侧 2px 条 / 当前步进度点 3 处改用 `var(--exp-accent, var(--river-700))`。
- 证据：
  - `npx tsc --noEmit` → 0
  - `npm run lint` → 0 error（15 warning 均为既有文件）
  - `npx vitest run` → 36 files / 519 passed（新增 11 条：气泡 5 + SSR 6）
  - `node scripts/contrast-audit.mjs`（BASE_URL=3002）：exp01 / exp03 / exp09 **严重 0 项、偏低 0 项**
  - 截图（1440×900 + bench 裁切 + 2x 细节）：`%TEMP%\chemlab-shots\scene-texture\`
- 三个主色：exp01 `#1f6f78`（瓷青，5.42:1）· exp03 `#3d5a9e`（石青，6.19:1）· exp09 `#a63a63`（酚酞玫红压深，5.74:1），对纸白底均 ≥4.5:1。
- 改了哪些文件：上述 8 个新文件 + 4 个既有文件（vessel-art.tsx / globals.css / mission-board.module.css / page.tsx）。未碰 lib/scene/fx.ts、lib/audio、login、lib/demo、workbench.tsx。
- 下一步 / 阻塞：无。已知边界：常驻气泡只在有液体的器皿出现（每器皿一组，算 1 个环境循环）；`prefers-reduced-motion` 下气泡静止、液体过渡关闭；未新增依赖/图片/filter。

## 2026-10-22 04:22 · 事故记录（非本轨道，供 Lead 复盘）
- 03:57 workbench.tsx 被 PowerShell 管道写坏（UTF-8→GBK→UTF-8 双重编码，43 行行尾丢字+丢引号），导致 3002 全站 Build Error；Lead 用可逆还原 + HEAD 匹配修复，我未改动该文件。教训：写中文文件只用 write/edit 或 `fs.writeFileSync(p, s, "utf8")`。
- 我临时用 `git worktree` 在 %TEMP% 做视觉验证（因主分支当时打不开），已清理（node_modules 用 junction，已单独删除 junction 再 remove worktree，仓库 node_modules 未受影响）。
