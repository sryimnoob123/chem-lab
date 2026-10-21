# design-lead · exp02 接通记录

- exp02 definition：**6 步**，选项 **5/4/5/4/4/5 = 27**；**trap 11 个**（步 2 只有 1 个，其余每步 2 个）。
- 覆盖：溶解+除 SO₄²⁻ → 除 Ca²⁺/Mg²⁺+过量 Ba²⁺ → 过滤 → 除过量 CO₃²⁻ → 蒸发结晶 → 抽滤/干燥/产率。
- L4：按 `docs/实验库/exp02.md` §7 H1「用移液管口吸 1.0 mol/L BaCl₂」→ `heavy-metal`，deduct 20，terminate；未自编 L4。
- L3：H2 蒸干强热 `boil-over`（−10）、H3 冷水冲热容器 `glass-break`（−8）。
- 注册：`lib/engine.ts` 已加 `exp02Definition`；`lib/catalog.ts` 与 `db/init.mjs` **均保持 exp02 playable:false**，用 `?force=1` 联调。
- 场景：复用 `demo-scene-instrument-balance` + 烧杯 + 容量瓶 + `demo-scene-reagent-na2co3-solid` + `demo-scene-reagent-water`；无新增 SVG。
- dev6 实测：
  - `?force=1` 进入 → 5 个 `demo-op-*`；步数 6。
  - 全对报告 **86 分**，学号 20250101，时间线 10 条。
  - 失败分支（step1 一次加 100 mL 水）两行 + 重试后交卷 **85 分**。
  - L4 口吸 BaCl₂ 终止；报告 30 分、事故 1 条。
  - `flow-chain` exp09 **9/9**；`tsc`/eslint 0。
- 截图：`%TEMP%\chemlab-shots\exp02-step1.png`、`exp02-failure.png`、`exp02-report.png`、`exp02-L4.png`。
