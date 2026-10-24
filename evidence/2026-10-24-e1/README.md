# E1 学生全链路真点巡检 · 2026-10-24（二轮）

脚本：`.team/e1-chain.mjs`（Playwright / chromium，全程点 DOM：按钮、拖器皿、拖试剂、填表单）。

```bash
# 本机 dev（3000，PGLITE_DIR=.pgdata-review 全新 init + seed-demo）
node .team/e1-chain.mjs --base http://127.0.0.1:3000 --out evidence/2026-10-24-e1/final
```

## 结果矩阵（final，本次口径）

| # | 环节 | 结果 | 原始数字 |
|---|---|---|---|
| 01 | 登录 | **OK** | `api/session=200`，`chem_sid=czoyMDI1MDEw…`，跳 `/experiments` |
| 02 | 前测 | OK | 首选项不解锁（提示「还有错题，看解析后改选再提交」）→ 按解析答案 D/B/C 重做后解锁 |
| 03 | 七步 | OK | 步骤 1→2→3→4→5→6→7，做完自动交卷 |
| 04 | 交卷 + 后测 | OK | 后测 100/100 → `/exp/exp01/report` |
| 05 | 分数 | OK | 总分 **86/100**（预习 0 / 操作 100 / 报告 92），后测 100 |
| 06 | 拼接实验 | OK | 主题 topic-hcl-standard，**28 项 / 100 分（规则校验）**，场景 `demo-scenario-good` 能播 |
| 07 | 教师端 | OK | 学生 40 / 已完成 26，本生行 `20250101 周若曦 化工25-1班 已完成 100% 刚刚 86 2` |
| 08 | 导出 CSV | OK | `chem-lab-学情-20261024.csv` **4550 B / 41 行**，表头「学号,姓名,班级,实验,状态,完成度,操作分,报告分,总分,事故数,最近活跃」 |

**合计 8/8**，非 2xx 请求 0 条、console error 0 条、pageerror 0 条，总耗时 45.3 s。

## 这一轮修掉的两个断点

1. **登录不提交会话（01 从 FAIL 变 OK）**：`app/login/page.tsx` 原来只 `router.push`，
   没有 `POST /api/session`，浏览器里没有 `chem_sid` → 报告/台账/动作落库全按兜底身份记成 20250101。
   现在补一次 `POST /api/session`（后端本来就是 `signInDemo`：留空/乱填/不在白名单全放行），
   `catch` 里吞掉失败，照旧能进 —— 不改变「不校验、不挡人」的演示口径。
2. **本轮排查时的一个假象（记下来别再踩）**：两个进程用同一个 `PGLITE_DIR` 会互相锁死，
   症状是**所有 DB 读接口 500**（`PGlite failed to initialize properly` / `Failed query`），
   而页面还能靠兜底数据渲染 —— 看起来像业务 bug，其实是环境。重开一个干净的 `.pgdata-review` 就全好。

## 仍然存在的缺口（没修，写清原因）

**前测分数不落库 → 预习分恒 0。** 前测（`components/exp/bopbps-gate.tsx`）只把「通过」写进
`localStorage`，题库答案从不提交；`quiz_answers` 表只有读路径没有写路径（`lib/persist/score.ts`
按 `phase="pre"` 算预习分）。所以真实学生的总分上限是 90（操作 40 + 报告 50），一键演示（`?auto=1`）
反而按满分落库。修它要动「前测 → 交卷 → 分数线」这条链，属于本轮边界（不碰教师端核心/报告口径），
已开后续任务卡。
