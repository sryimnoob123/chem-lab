# BUG 维护通道（用户随时点测 → 我们定期修）

> 用途：用户会随时点测报 bug。本文件是**唯一待办队列**，修完就往下归档。
> 规矩：**每条 bug 必须有复现路径 + 归属文件 + 状态**，不许口头修完就完事。
> 回归命令统一用 `node scripts/flow-smoke.mjs <expId>`（dev，快）与 `node scripts/flow-chain.mjs <expId>`（生产，终验）。

---

## 0. 收到 bug 后的固定动作（30 分钟内）

1. **复现**：按用户给的路径走一遍，录下 URL + 截图 → `%TEMP%\chemlab-shots\bug-<日期>-<短名>\`
2. **定位**：写清楚「现象 / 根因（文件:行）/ 影响面（单实验 or 全站）」
3. **定级**：P0 崩/卡死/数据错；P1 流程断（点了没反应、跳错页）；P2 视觉/动效/文案
4. **修**：P0/P1 当场修；P2 批量修
5. **回归**：`flow-smoke` 该实验 8/8 + `npx tsc --noEmit` + `npx vitest run` 不退化
6. **归档**：本文件表格里填 ✅ + 证据路径

---

## 1. 待办队列

| # | 级别 | 现象 | 复现路径 | 根因 / 归属 | 状态 |
|---|---|---|---|---|---|
| B-002 | P2 | 操作台右侧信息过密（参数卡/老师会说/时间线/其他做法同屏） | `/exp/*` | 用户明确反馈"UI 很乱"，见 STYLE §5.1；由 workbench-ux 收敛 | 进行中 |

> 新 bug 追加到表尾，编号顺延。

---

## 2. 已修复归档

| # | 现象 | 根因 | 修法 | 证据 |
|---|---|---|---|---|
| B-000 | `lib/demo/director.ts` 中文注释丢换行 → 63 条 tsc 错误 | 用 PowerShell 重定向写中文文件，GBK 编码 + 合并行 | 按 UTF-8 用 write/edit 重写；定规「中文文件只用 write/edit」 | `npx tsc --noEmit` = CLEAN |
| B-001 | 交卷后按钮长时间停在"交卷中…"，像卡死 | 不是 bug：dev 首次编译 `/api/runs/:id/finish` 慢（10s+），测试脚本只等 1.5s | 测试脚本改为等 URL 跳转（flow-smoke.mjs 已改）；产品侧建议后续加 8s 超时兜底（P3） | exp01 交卷 1.1~2.9s 完成 |
| B-003 | **P0** exp08/exp09 打开即崩：`TEACHER_NOTES is not defined`（页面全白，无法操作） | `workbench.tsx` 拆分 `teacher-notes.ts` 时只加了 import，第 1092-1101 行仍引用旧常量名 | 改用 `teacherNote(expId, step.index)` 单点取值（helper 自带兜底文案） | `flow-smoke exp08` 8/8、`exp09` 8/8 |

---

## 3. 回归基线（2026-10-21 17:35 建立）

| 项 | 基线 | 怎么跑 |
|---|---|---|
| 主流程 exp01 | 8/8 通过（门户→登录→实验→正确→错误→重做→交卷→报告） | `$env:BASE_URL="http://localhost:3002"; node scripts/flow-smoke.mjs exp01` |
| 类型 | 0 error | `npx tsc --noEmit 2>&1 \| Out-String`（输出为空才算好） |
| 单测 | 444 passed / 27 files | `npx vitest run` |
| lint | 0 error（8~9 条既有 warning 不算） | `npm run lint` |
| 动效/性能预算 | 见 `scripts/motion-audit.mjs` | `$env:BASE_URL=...; node scripts/motion-audit.mjs` |

**不是 bug 的已知现象**（别浪费时间）：
- dev 模式 `flow-chain.mjs` 的 `networkidle` 会超时 → 用 `flow-smoke.mjs`；生产模式才用 flow-chain。
- dev 首次访问某路由会编译，慢 5~15s；第二次就快。
- PowerShell 输出中文乱码不影响代码；判断 tsc 只看输出是否为空。

---

## 4. 用户报 bug 的最省事模板

```
页面：/exp/exp01
我点了：拖 NaOH 到锥形瓶
预期：有倒入动画 + 成功提示
实际：直接跳到下一步，没动画
截图：（可选）
```

有这三行就够定位；没有也行，我们按复现路径自己走。
