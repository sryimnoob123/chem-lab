# handoff · scene-texture（实验台 2.5D 质感，改派轨道）
## 交付
- 器皿绘制已迁到 `components/exp/scene/vessels/`（`vessel-art.tsx` 只剩 5 行兼容 re-export，调用点未变）。
- 三层质感：外轮廓 `--glass-outline` 1.4px / 内侧 1px `--exp-accent` 亮边（宽描边 + clipPath 只留内侧）/ 底部反光弧 `reflectArc`；纸白底无白色高光。
- 液体：上浅下深（叠 `--liquid-depth` 渐变）+ 液面细椭圆 + 微光晕 + 每器皿 5 颗常驻气泡（`lib/scene/vessel-paint.ts`，6~9s、错开延迟、SSR 确定）。
- 主色：`--exp-accent` 由 `app/exp/[id]/page.tsx` 的 `<div data-exp={id} style={{display:"contents"}}>` 提供；exp01 `#1f6f78` / exp03 `#3d5a9e` / exp09 `#a63a63`（纸白底 5.42 / 6.19 / 5.74 : 1）。
- 跟着主色走：器皿内壁、左上高光、液面/光晕、底部反光；任务看板 expNo / 目标左侧条 / 当前步进度点。
## 约束遵守
不引库/依赖；只动 transform/opacity（液体 fill 过渡是 600ms 既有例外）；不用图片；不用重型 SVG filter；每文件 ≤300 行（最大 glass-vessel 210）。
## 证据（2026-10-22 04:22）
tsc 0 / lint 0 error / vitest 36 files 519 passed / contrast-audit exp01·03·09 均「严重 0、偏低 0」。
截图：`%TEMP%\chemlab-shots\scene-texture\{exp01,exp03,exp09}-1440x900.png` + `*-bench.png` + `zoom-exp09-beaker.png`。
## 注意
- 别改 `data-exp` 外层 div（display:contents），否则主色断链。
- 常驻气泡只在有液体时渲染；reduced-motion 下静止。
- 未改 workbench.tsx / lib/scene/fx.ts / lib/audio / login / lib/demo。
