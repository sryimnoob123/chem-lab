# design-lead · exp03 接通记录

- exp03 definition：**6 步**，选项 **5/4/3/4/5/5 = 26**；**trap 11 个**。
- 覆盖：配母液+安全 → 系列稀释 → 恒温 → 两点校准 → 测样 → 数据处理+电极保养。
- 第 1 步选项顺序（验收脚本关键）：
  1 assemble，2 transfer，3 dilute，4 **`demo-op-step1-open`（L4，终止）**，5 **`demo-op-step1-cylinder`（可恢复，L2）**。
  - 可恢复 trap：`demo-op-step1-cylinder`，出现 `demo-retry-1`，重做后恢复 5 个选项。
  - L4：`demo-op-step1-open`，H1 toxic-gas，terminate，无 retry。
- L3：H2 电极球泡撞击 `glass-break`（step5）、H3 湿手插拔 `device-accident`（step6）。
- 注册：`lib/engine.ts`；catalog / db/init 均**未动，exp03 仍 false**，用 `?force=1`。
- 场景：复用 analysis balance / 烧杯 / 容量瓶 / `demo-scene-reagent-water`；无新增 SVG，pH 电极 TODO。
- dev7 实测：
  - `?force=1` → 5 个选项，6 步。
  - 可恢复 trap 两行 + retry + 全对 → 报告 **84 分**，学号 **20250101**。
  - L4 → 报告 30 分、事故 1 条。
  - `flow-chain` exp09 9/9；tsc/eslint 0。
- 截图：`%TEMP%\chemlab-shots\exp03-step1.png`、`exp03-failure.png`、`exp03-report.png`、`exp03-L4.png`。
