# design-lead · exp04 接通记录

- exp04 definition：**5 步**，选项 **4/4/5/5/5 = 23**；trap **10 个**；每步至少 1 个 L3。
- 覆盖：器皿检查 → AgCl 制备 → 离心/洗涤 → 氨溶/转化 → 分步沉淀 + 弱电解质溶解 + 废液。
- 第 1 步可恢复 trap（最后一项）：`demo-op-step1-crack`（H1，L3，glass-break）→ `demo-retry-1`。
- L4（第 3 步）：`demo-op-step3-imbalance`（H4，device-accident，terminate，无 retry）。
- L3 分布：H1（step1）、H3（step2）、H5（step3）、H8（step4）、H12（step5）；H4 为 L4。
- 注册 `lib/engine.ts`；catalog / db/init 未动，exp04 仍 false，`?force=1` 联调。
- 场景复用 analysis balance/烧杯/试管/容量瓶/na2co3/水；无新增 SVG，离心机 TODO。
- dev8 实测：full 报告 86 分（无事故），失败+重试后 85 分（事故 1 条），学号 20250101；L4 报告 30 分、事故 1 条；flow-chain 9/9；tsc/eslint 0。
- 截图：`%TEMP%\chemlab-shots\exp04-step1.png`、`exp04-failure.png`、`exp04-report-clean.png`、`exp04-L4.png`。
