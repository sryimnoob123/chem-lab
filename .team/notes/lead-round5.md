# lead · 第 5 轮（2026-10-21 10:15 起）

## 当前状态（会话交接用）

### 已完成且已推 GitHub
- 仓库：https://github.com/sryimnoob123/chem-lab（public），`main`
- 已推提交：`82a7136`（10 实验 + BOPPPS + 方案设计 + 教师导出）、`92345f1`（BOPPPS 同屏 + 抽屉 + L4 验收）、`6122400`（e2e 裸跑自动建库）
- 本地 = 远端 = `6122400`（10:0x 时点）

### 本轮新增（尚未提交）
- `components/exp/bopbps-gate.tsx`：新增 `?fresh=1` / `?reset=1` 参数，清 localStorage 中的预习记录并强制回问卷（排查"看不到最新界面"用）
- 已 rebuild（build 退出码 0）并重启 3001；`/preview.html` 含「平台能力」、`/exp/exp01` 服务端输出含「操作台已就位」→ 说明新构建已生效
- 重启后 **未重建库**（沿用 `.pgdata-prod2`），`POST /api/session` 返回 200

### 正在排查的问题（阻塞）
`scripts/samescreen-check.mjs` 登录后 `page.waitForURL(/\/experiments/)` 15s 超时。
- 同一脚本 10:0x（重启前）能通过，5 项全绿
- 现象：登录提交后页面不跳转；`/experiments` 直接 curl（跟随重定向）返回 200；server.err.log 无错误
- 怀疑：PGlite 被强杀后部分损坏（能返回 200 但 session/查询路径异常），或登录页前端跳转逻辑受新构建影响
- 待验：带 cookie 的完整登录→列表链路；必要时重建库（流程见下）

## 关键操作流程（别忘）
1. 改动 → `npx tsc --noEmit` + `npm run lint` → `npm run build`
2. 停服务用 `Stop-Process -Id <pid>`（会强杀 PGlite，可能损坏）
3. 库损坏的表现：`RuntimeError: Aborted()`、login 500、或能 200 但后续查询异常
4. 修复：把 `.pgdata-prod2` 改名 → `npm run db:init` → `npm run db:demo`（重建演示数据，40 学生，`20250101 / 周若曦`）
5. 启动：`node .next/standalone/server.js`，env `PORT=3001 HOSTNAME=127.0.0.1 PGLITE_DIR=<abs>`；启动前先 `Copy-Item public .next\standalone\public -Recurse -Force`（静态清单启动时生成，不复制会 404）
6. 验收脚本（都要 `BASE_URL=http://localhost:3001` + `PLAYWRIGHT_BROWSERS_PATH=%LOCALAPPDATA%\ms-playwright`）：
   - `bopbps-all.mjs`（10 实验前测→操作台）
   - `samescreen-check.mjs exp01`（同屏 5 项）
   - `l4-check.mjs`（L4 终止）
   - `plan-teacher-check.mjs`（方案设计 + 导出）
   - `demo-mode-check.mjs`（演示导演台 9/9）
   - `exp-chain.mjs <trapId>`（单实验整链，EXP_ID 环境变量）
   - `pg-verify.mjs`（真 PG 21/21，用 `E:\TOOLS\pgsql\bin`）

## 下一步
1. 查清登录不跳转的根因（优先怀疑 PGlite 损坏 → 重建库再测）
2. 修好后复跑 `samescreen-check` + `bopbps-all`
3. 提交并推 GitHub
4. 给用户明确的自测入口（含 `?fresh=1` 用法）
