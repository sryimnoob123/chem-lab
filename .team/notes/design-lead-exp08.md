# design-lead · exp08 接通记录

- exp08 definition：7 步，选项 5/4/5/5/5/5/5 = 34，14 个陷阱（每步 2 个）。
- 注册：`lib/engine.ts` 的 DEFINITIONS 已加 exp08；`?force=1` 可绕过 catalog 门禁联调。
- 3001 空操作台根因：不是 `experiment-data.ts`（workbench 未使用），而是
  `loadCatalog()` 用 DB `experiments.playable=false` 覆盖了 `lib/catalog.ts` 的 true；
  页面进入 `LockedOrMissing` 的 “操作台还在接通中” 分支，所以 0 个 `demo-op-*`。
  修：静态 true 不再被旧 DB 反向关掉（`c.playable || dbRow`）；3001 需重 build。
- 顺手修：workbench 动作 POST 串行化，避免快速点击时并发落库乱序导致报告时间线缺记录。
- 场景：exp08 复用 `demo-scene-instrument-balance` / 烧杯 / `demo-scene-reagent-na2co3-solid`，无新增 SVG。
- 本地 dev5 证据：
  - 全对报告 84 分，学号 20250101，时间线 10 条。
  - 失败分支（step4 直接倒秤盘）两行：标题 “试样嵌入秤盘缝隙、腐蚀盘面，示值长期失准”；
    为什么 “固体嵌入盘面缝隙，NaCl 吸湿后腐蚀金属盘面，残留质量叠加到后续称量，全部数据带正偏差。”
  - L4 整瓶上秤：终止，报告 35 分，事故 1 条。
  - `flow-chain.mjs` 默认 exp09 9/9；`tsc` / eslint 0。
- 截图：`%TEMP%\chemlab-shots\exp08-dev5\01-step1.png`、`02-failure.png`、`05-report-final.png`；
  L4：`%TEMP%\chemlab-shots\exp08-L4.png`。
