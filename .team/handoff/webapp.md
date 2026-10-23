# 交接 · webapp（2026-10-23 晚 · 实验台 2.5D 版式与质感）

## 一句话
54 个散改已分批提交成 9 条 commit（本地，未 push）；exp01 台面版式与质感按用户口径落定，四绿全过。

## 现在能看的
- dev：http://localhost:3000/exp/exp01?force=1 （生产口 3001 同版，重启见下）
- 整屏截图（每次排版改动覆盖这一张）：`%TEMP%\chemlab-shots\bench-latest.png`

## 版式（1280 宽实测，谁挪谁知道）
左 18..112 试剂三层小板 / 198..314 天平 / 346..812 器皿行 / 左下洗槽 / 右下工具托盘 / 右侧任务卡。
器皿与天平底边同压 viewBox y=340（`BENCH.top`）。

## 硬坑（下次别再踩）
1. `BENCH.surface`(286) ≠ `BENCH.top`(340)：surface 是墙台接缝，器皿基线是 top。放仪器用 top。
2. e2e 要 `PLAYWRIGHT_BROWSERS_PATH=.../AppData/Local/ms-playwright`，默认路径缺 1248 版浏览器。
3. build 前先杀 3001：`MSYS2_ARG_CONV_EXCL="*" taskkill /F /PID <pid>`，否则 `.next/standalone` EBUSY。
4. 高视口台面悬空已修：bench-scene 用 ResizeObserver 把 viewBox 补到容器比例（wallExtra/floorExtra）。

## 下一步（按价值排）
1. 「倾倒可信」：拖试剂到器皿后逐帧看（举瓶→倾斜→液柱→液面涨），不够就调 bench-pour 时序。
2. 天平命中区比图形小（CDP 坐标点在图形左边界点不到，DOM click 正常），补 hitBox 断言 + 放大热区。
3. `scripts/exp01-chain.mjs` 过时（卡前测门禁），修脚本或删掉换 e2e。
4. 拖拽中器皿放大 1.06 → 1.03，在洗槽上方看着偏大。
