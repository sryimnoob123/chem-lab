# 交接 · webapp（2026-10-23 晚 · 实验台收尾 + 对抗报告首轮返修）

## 一句话
三个尾巴收了（拖拽 1.03 / 天平热区 / 七步截图），三份对抗报告的 P0 已修（倒错试剂、天平读数、倾倒提前亮、前沿悬空、器皿名基线），四绿全过并已 push 到 main（HEAD 1bc2779）。

## 现在能看的
- 生产口：http://localhost:3001/exp/exp01?force=1 （已是最新构建；改完必须 build + `scripts/restart-prod.ps1`）
- 整屏进展图：`%TEMP%\chemlab-shots\bench-latest.png`（`node scripts/bench-latest.mjs` 覆盖生成）
- 七步逐步截图：`%TEMP%\chemlab-shots\exp01-steps\01-step-1.png … 09-postlab.png`（`node scripts/exp01-seven-steps.mjs`）
- 倾倒逐帧：`%TEMP%\chemlab-shots\pour-film\`（`node scripts/pour-film.mjs`）

## 版式（1440 宽实测，谁挪谁知道）
左 18..112 试剂三层小板 / 210.. 天平 / 器皿行 / 左下洗槽 / 右下工具托盘 / 右侧任务卡。
器皿与天平底边同压 viewBox y=340（`BENCH.top`）；台面下沿 = `BENCH.bottom + floorExtra`，前沿厚度贴这条下沿。

## 硬坑（下次别再踩）
1. `BENCH.surface`(286) ≠ `BENCH.top`(340)：surface 是墙台接缝，器皿基线是 top。放仪器用 top。
2. 拖拽放大的真正来源是 `.vesselLift`（原 1.04），不是 use-drop-flow 的 1.06（被 `transform:none !important` 压着不生效）。
3. 天平是线框+文字，SVG 只在「画了填充/描边」处命中 → 必须补 `fill:transparent` 热区（`fill:none` 不参与命中）。
   热区尺寸别手写：用 `balanceHitBox()`（`BALANCE_ART` + 描边半宽 0.8 + 1 单位）；`getBBox` / `getBoundingClientRect`
   **都不含描边**，拿它俩互比会得到「已经对齐」的假象，只有 `elementFromPoint` 在图形边缘外 0.5px 采样才看得出小一圈。
4. WAAPI `fill:"both"` + delay 会把 0% 帧提前铺满整个 delay（涟漪/液柱因此刚松手就出现）→ 改 `forwards` + 基础态 `opacity:0`。
5. 第 7 步做完不推进步号、直接结算 → 只认步号的脚本会误判「卡住」。
6. 脚本/测试里别写「外层双引号里塞单引号」的选择器字符串（会被写成 `x"]'` 直接语法错），用 `[data-demo-id=x]`。
7. e2e 要 `PLAYWRIGHT_BROWSERS_PATH=.../AppData/Local/ms-playwright`；build 前先杀 3001，否则 `.next/standalone` EBUSY。

## 门禁（本机口径）
tsc / eslint（`node node_modules/eslint/bin/eslint.js`，22 warning 全为历史）/ vitest 46 files 633 / e2e 26 passed（`E2E_BASE_URL=http://localhost:3001`）；对比度审计 0 严重 0 偏低。

## 等用户拍板（`.team/notes/webapp.md` 第四节有代价对比）
① 做完最后一步自动跳后测 vs 停在结算卡；② 交卷要不要二次确认；③ 第 7 步「水入酸」要不要能真的犯；④ 窄屏字号是否按屏幕像素反算。

## 下一轮 P1
A：右侧安全边（托盘宽 / rowRightWide / 最右器皿统一由面板宽推）＋ 1152 宽下试剂架压天平。
B：第 1 步判据去掉「认领单签字」；洗涤槽缺落点提示；第 6 步「放入锥形瓶」但场景无锥形瓶。
C：无色液体加弯月面线、器皿接地影、字号不随视口漂。

## 2026-10-23 第 1 轮（自动接力）· 已收 A0–A3

- **A0 右栏安全边**：`use-safe-right.ts` 量右栏左沿 → `fitTray` 收托盘、`shiftInsideRight` 器皿整行左移；`layoutDx` 同时喂 `ActionLayer` / `BenchPour`，动作锚点不偏。实测 1152 托盘 +34→-12px、1024 锥形瓶 +28→-15px，1440 完全不动。
- **A1/A2/A3 一并打勾**：A1 已有 `e2e/drag-scale.spec.ts` 守卫；A2 有 `balance-hit.spec.ts` 3×3 采样；A3 七步截图在新构建上重跑 7/7 + 9 张。
- 门禁：tsc 0 / eslint 0 error 22 warning / vitest 644 passed / e2e 42 passed / build ✓。
- 再量一次就跑 `node scripts/bench-safe-right-measure.mjs`（四个视口「改前→改后」一张表）。
- 下一轮按计划从 **B1 玻璃器皿五层** 起。
