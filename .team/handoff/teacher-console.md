# handoff · teacher-console（教师端：学情总览 / 名单管理 / 学生明细）

**状态：已交付，四绿通过（tsc 范围内 0 错误 / eslint 0 error / encoding 通过 / shots 三视口无 404·无 console error·无溢出）。**

## 交付物
| 路由 | 文件 | 说明 |
|---|---|---|
| `/teacher` | `app/teacher/page.tsx` | 5 张指标（细线台账格）+ 事故 L1~L4 堆叠条 + 高发 top3 + 学生台账 9 列表格 + 搜索（300ms 防抖写 URL）+ 状态分段筛选 + 导出 CSV |
| `/teacher/roster` | `app/teacher/roster/page.tsx` | 说明条、上传 CSV / 粘贴名单双通道导入、名单表（学号/姓名/班级/登录状态/删除）、底部「共 N 人 · 已登录 M 人」 |
| `/teacher/student/[no]` | `app/teacher/student/[no]/page.tsx` | 三段分刻度（预习 10/操作 40/报告 50）、能力点横条、事故清单、最近操作时间线（等宽） |
| 外壳 | `app/teacher/layout.tsx` | 暗场顶栏（校徽白块 + 校名 + 教师端标签 / Tab / 刘建彩 + CSS 头像）+ 页边刻度尺 01/02/03；未解锁时多一个「教师解锁」 |
| 组件 | `components/teacher/*` | 16 个文件，单文件 ≤142 行；查询统一走 `components/teacher/queries.ts`（本地类型 `types.ts` 对齐 data-api 口径） |
| 样式 | `app/globals.css` 末尾 `/* ===== teacher ===== */` | 只追加，未改既有规则 |

## 依赖口径（与 data-api 对齐）
- `competency` 是 **0~100 整数**（不是 0~1）；`runs[].runId`；timeline/incidents 带 `label`。
- 写操作（导入/删除/导出）需 `chem_teacher` cookie：口令默认 `2026`，`POST /api/teacher/unlock`。

## 已知取舍 / 待 Lead 决策
1. `scripts/shots.mjs` 的 PAGES 只有 `/teacher`；`/teacher/roster`、`/teacher/student/<no>` 用 `.team/teacher-shots.mjs` 补测（会先 unlock）。建议 Lead 把这两条加进 PAGES。
2. 官方 `npm run shots -- teacher` 无教师 cookie，顶栏会显示「教师解锁」chip；要设计稿口径的登录态基线用 `.team/teacher-shots.mjs`。
3. 学生不存在用壳内 `MissingStudent` 错误态（HTTP 200）而不是 `notFound()`：实测 `loading.tsx` + `notFound()` 在 dev 会卡在骨架不 swap（`app/teacher/loading.tsx` 与 404 的互斥问题），已写进 notes。
4. 教师端同屏字号只有 12/14/25/32 四档；13px 已从教师段全部移除。

## 2026-10-21 能力点雷达（追加交付）
- 组件：`components/teacher/radar-chart.tsx`（纯 SVG，5 轴 / 3 环 / 多边形 / 顶点 `<title>` hover / 轴标签+数值 / 图例 / 空态，容器最宽 420，宽 390 时随容器缩到 332），样式在同目录 `radar-chart.module.css`（**没动 globals.css**）。
- 口径：`components/teacher/radar-data.ts` 纯函数 + `radar-query.ts` 取数（Server）。
  - 班级：非演示 run → 每次 run 按 `computeMastery` 算 5 个能力码 0~100（timeline 对错 + incidents 按 registry 归属）→ 每维只对**有该码记录**的 run 求平均；没记录的维画 0，图例写「暂无数据」。
  - 单学生：`detail.competency`（与左侧横条同口径）+ `loadStudentRecordedCodes()` 修 `hasData`，把 data-api 的「定义占位 0」标成暂无数据；页面与班级共用同一个 `CompetencyRadar`，只有 `scope` 文案不同。
- 测试：`components/teacher/radar-data.test.ts`，`npx vitest run components/teacher` = **13 passed**（无数据 / 单条 / 多条每维不同分母 / 缺维补 0 / 脏样本 / 记录集合修正）。未新增任何 vitest 配置（用根 `vitest.config.ts` 的 `components/**/*.test.ts`）。
- 证据：`%TEMP%\chemlab-shots\teacher-chart\`（teacher-1440 / teacher-full-1440 / teacher-390 / student-1440 / student-done-1440 / student-empty-1440 / student-empty-390）；三视口 `scrollWidth == clientWidth`。
- 注意：我本地 3004 dev 用 `.pgdata-dev14`（`.pgdata-dev10` 被并发进程搞到 PGlite init 失败后重建）。

## 证据
- `%TEMP%\chemlab-shots\20261020-2012\teacher-{desktop,tablet,mobile}.png`（官方 shots）
- `%TEMP%\chemlab-shots\teacher-extra\*.png`（15 张：三页 + 空态 + 404 × 三视口）
- `%TEMP%\chemlab-shots\teacher-chart\*.png`（雷达，见上）
- 明细：`.team/notes/teacher-console.md`
