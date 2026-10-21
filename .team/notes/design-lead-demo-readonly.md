## 2026-10-21 02:05 · 演示模式只读（不脏数据）

### 做了什么
- `app/exp/[id]/page.tsx` 读 `play=demo`，传 `demoReadonly` 给 Workbench。
- `workbench.tsx`：
  - `bootstrap()` 在只读模式只拉 `/api/session`，**不 POST `/api/runs`**。
  - `sendAction()` 在只读模式直接 return，不排队、不 POST events。
  - `finish()` 在只读模式直接 `router.push('/exp/{id}/report')`，**不 POST finish**。
  - 顶栏新增 `data-demo-id="demo-readonly-badge"` → `演示模式 · 不记录`（琥珀小标记，移动端绝对定位）。
  - 本地 reducer、双分支、重做、提示、动画全部照常。
- `workbench.module.css`：`.readonlyBadge` 桌面/移动样式。

### 证据
- 带 `?play=demo` 自动走完 6 步 → 交卷：
  - badge 1 个，文案 `演示模式 · 不记录`；
  - `/api/runs` 请求 **0**（`apiRuns: []`，beforeFinish 0）；
  - 交卷后 URL `/exp/exp09/report`（无 runId），200；
  - console/pageerror 0。
  - 断言 JSON：`%TEMP%\chemlab-shots\demo-readonly\assert.json`
  - 截图：`demo-readonly.png`、`demo-six-steps.png`、`demo-report.png`、`demo-readonly-mobile.png`
- 只读失败分支/重做：`demo-op-step1-bare-hands` → `demo-feedback-fail-1`；`demo-retry-1` 清除失败；`apiRuns` 仍 0。
- 正常路径：无 badge；首屏 `POST /api/runs`、动作后 `POST /api/runs/:id/events` 照旧。
- `node scripts/flow-chain.mjs` → **9/9**。
- `npx tsc --noEmit` → exit 0；`npx eslint "app/exp/[id]"` → exit 0。
