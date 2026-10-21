# teacher-console · 教师端（学情总览 / 名单管理 / 学生明细）

## 2026-10-20 19:05 · 完成：教师端三页 + 外壳首次可跑通（三视口 200，无溢出/console error）
- 做了什么：
  - `app/teacher/layout.tsx` 暗场顶栏（校徽白块 32 + 课程名 + 教师端标签 / Tab / 刘建彩 + CSS 圆点头像）+ 页边刻度尺（01/02/03）。
  - `app/teacher/page.tsx` 学情总览：5 张细线台账指标格、L1~L4 事故堆叠条 + 高发事故前 3、学生台账表（9 列）、搜索（300ms 防抖写 URL）+ 分段筛选 + 导出 CSV。
  - `app/teacher/roster/page.tsx` 名单管理：说明条、上传 CSV / 粘贴名单两种导入、名单表（学号/姓名/班级/登录状态/删除）、底部人数。
  - `app/teacher/student/[no]/page.tsx` 学生明细：三段落分刻度、能力点横条、事故清单、最近操作时间线。
  - 组件拆到 `components/teacher/*`（每个页面文件 < 200 行）；CSS 只在 `app/globals.css` 末尾 `/* ===== teacher =====` 段追加。
- 证据：
  - `npx tsc --noEmit`：我范围内 0 error（当时唯一报错在 data-api 的 `lib/queries/export.ts`，已由其修复；现在全绿）。
  - `npx eslint app/teacher components/teacher`：0 error 0 warning。
  - `npm run shots -- teacher` → `%TEMP%\chemlab-shots\20261020-1906\teacher-{desktop,tablet,mobile}.png`，脚本自动检查通过（无 404 / 无 console error / 无横向溢出）。
  - 另外两个页面当时未在 `scripts/shots.mjs` 的 PAGES 里，用 `.team/teacher-shots.mjs`（Playwright，三视口）补测：`%TEMP%\chemlab-shots\teacher-extra\*.png`，三视口 `scrollWidth == clientWidth`。
- 中途修掉的真实问题：
  1. `.tch-main` 用 `padding: 26px 0 48px` 把 `.page-shell` 的横向页边抹掉了，内容贴边 → 改 `padding-block`。
  2. 移动端 390 表格列宽算错：姓名换行、状态折成 3 行 → 重算列宽（学号 72 / 姓名 54 / 完成度 44 / 总分 34 / 事故 34 / 详情 36，当前环节拿剩余 58），状态字号降到 12，进度条 40。
  3. 搜索框受控 + `useEffect` 同步 `initialQ` 触发 `react-hooks/set-state-in-effect`（eslint error）→ 改非受控 + ref，只在“用户不在输入框”时回写 DOM。
  4. `--warn` 当 13px 正文对比度约 2.7:1 不过 rubric 9 → `进行中` 文字改 `color-mix(--warn 60%, --ink)`（≈5.3:1），进度条仍用原 token。
- 待办 / 阻塞：
  - `data-api` 已修 label 回落（timeline 英文 actionType、incident 裸 id），下次截图确认。
  - `StudentDetail.timeline` 目前按 `at` 倒序展示，demo 数据里步骤顺序看起来乱（7/5/4/6…），要再确认 `at` 是否同秒。
  - `scripts/shots.mjs` 的 PAGES 只有 `/teacher`，建议 Lead 加 `/teacher/roster` 与 `/teacher/student/<no>`（我无该文件写权）。

## 2026-10-20 20:15 · 完成：教师端三页 + 状态页最终自检（tsc/lint/encoding/shots 全绿）
- 做了什么：
  1. 数据恢复后重跑三视口：`/teacher`、`/teacher/roster`、`/teacher/student/20250101`、`/teacher?q=zzzz`（空态）、`/teacher/student/99999999`（不存在）全部 200，`scrollWidth == clientWidth`（1440/768/390）。
  2. 修掉 19:19 库损坏后暴露的 label 问题验证：时间线已显示「称量 / 溶解 / 转移 / 滴定 / 读数 / 计算」，事故显示「半滴未靠壁 / 俯视读数 / 滴定管未润洗」，高发事故 top3 = 水入酸（热液喷溅）10 次 / 气泡未排尽 9 次 / 俯视读数 8 次。
  3. 时间线排序从「纯 at 倒序」改为「stepIndex 倒序 → at 倒序」：demo 同一 run 的 at 会压缩到同一秒，纯 at 排序会把第 7 步夹到第 4 步下面。
  4. 补状态设计：`app/teacher/loading.tsx` 静态骨架；空态（带「清空筛选」/「去名单管理导入名单」链接）；学生不存在用壳内 `MissingStudent` 错误态（**不用 notFound()**：`loading.tsx` 的 Suspense 壳 + `notFound()` 在 dev 下会只停在骨架、404 UI 永远不 swap，实测复现；改成 200 + 设计好的错误态后正常）。
  5. 顶栏补「教师解锁」入口：`/api/teacher/**` 写操作走 `requireTeacher()`，未解锁一律 403；解锁 chip 只在未登录时出现（`isTeacher()` 服务端判断），解锁后顶栏就是「刘建彩 + 圆点头像」。
  6. 字号收口：教师端内不再使用 `--text-13`，同屏只有 12/14/25/32 四档（rubric 3）。
- 证据：
  - `npm run shots -- teacher` → `%TEMP%\chemlab-shots\20261020-2012\teacher-{desktop,tablet,mobile}.png`，脚本自动检查通过（无 404 / 无 console error / 无横向溢出）。
  - `.team/teacher-shots.mjs`（会先 `POST /api/teacher/unlock` 再截图）→ `%TEMP%\chemlab-shots\teacher-extra\`：
    teacher / roster / student / student-404 / teacher-empty × desktop,tablet,mobile = 15 张，全部 `unlockChip=0`（已登录态）、无溢出。
  - `npx tsc --noEmit`：教师端范围 0 错误（全仓唯一错误在 `app/exp/[id]/scene-stage.tsx`，不是我的文件）。
  - `npx eslint app/teacher components/teacher`：0 error 0 warning。
  - `node scripts/check-encoding.mjs`：通过。
- rubric 12 条自检（教师端口径）：
  1 记忆点=页边刻度尺 01/02/03 + 暗场顶栏 + 等宽大数字；2 无卡片墙/渐变/大写眉标/居中正文，圆角仅 2px（头像圆形是任务明确要求）；3 同屏 12/14/25/32 四档，主按钮 0~1 个；4 语义色只在事故等级条/等级点与完成度细条（任务明确要求 `--jade-600/--warn`），未用于按钮/链接/边框；5 无器皿；6 无液体/沉淀/气体；7 390 无横向溢出、表格收「班级/最近活跃」、按钮/输入≥44px（返回链接为 32px 次要文本）；8 只有全局 hover/active 140ms transform/opacity，无禁用项；9 正文 ink/ink-2 均 ≥4.5:1，`进行中` 用 `color-mix(--warn 60%, --ink)` 压到 ≈5.3:1，焦点环全局 2px；10 reduced-motion 走全局降级；11 打印非本页职责；12 空态/错误态/加载态均落地（见上）。
- 改了哪些文件：`app/teacher/**`（layout/page/roster/student/[no]/loading）、`components/teacher/**`（16 个组件）、`app/globals.css` 末尾 `/* ===== teacher ===== */` 段落、`.team/teacher-shots.mjs`（补测脚本）。
- 下一步 / 给 Lead：
  - `scripts/shots.mjs` PAGES 建议补 `/teacher/roster`、`/teacher/student/20250101`、`/teacher?q=zzzz`（无该文件写权限）。
  - 官方 shots 不带教师 cookie，顶栏会显示「教师解锁」；要登录态基线用 `.team/teacher-shots.mjs`，或给 shots 加 unlock 步骤。

## 2026-10-21 11:30 · 完成：能力点雷达（班级 + 单学生，纯 SVG + 单测）
- 做了什么：
  1. `components/teacher/radar-data.ts`：5 维常量（K1/K2/A1/S1/S2，顺序固定）、`clampPercent`、`radarSeriesFromCompetency`、`averageRadarSeries`（每维分母只算有该码的样本；缺维 value=0 + hasData=false）、`restrictRadarToRecordedCodes`（把 data-api 定义占位 0 标成「暂无数据」）。
  2. `components/teacher/radar-query.ts`（Server）：`loadClassRadarSeries()` 取非演示 run 的 timeline 对错 + incidents→能力码，按 run 用 `computeMastery` 折算 0~100 后逐维平均；`loadStudentRecordedCodes(no)` 取真实有记录的能力码。
  3. `components/teacher/radar-chart.tsx` + `radar-chart.module.css`：纯 SVG（5 轴 / 3 环 / 数据多边形 / 顶点 `<title>` hover / 轴标签+数值 / 图例 / 空态），viewBox 420×300，容器最宽 420，`scope: "class" | "student"` 只换文案；390 宽缩到 332 无溢出。
  4. `app/teacher/page.tsx`：雷达区插在事故分布与「学生台账」之间；`app/teacher/student/[no]`：雷达在最上方，复用同一组件，并把无记录学生的横条也一并空态化。
- 证据：
  - `npx tsc --noEmit` 0 错误；`npm run lint` 0 error（8 条警告均在别的角色脚本里）；`node scripts/check-encoding.mjs` 通过。
  - `npx vitest run components/teacher` → **13 passed**（原 10 + 记录集合修正 3）；未加任何 vitest 配置（走根 `vitest.config.ts` 的 `components/**/*.test.ts`）。
  - `.team/radar-shot.mjs` / `.team/radar-check.mjs`（Playwright，先 unlock）→ `%TEMP%\chemlab-shots\teacher-chart\`：teacher-1440、teacher-full-1440、teacher-390（全页）、student-1440、student-done-1440、student-empty-1440、student-empty-390；三视口 `scrollWidth == clientWidth`，无 404 / 无 console error。
  - 实测占位 0 修正生效：学生 20250101 图例显示「K2 0 暂无数据 / S1 0 暂无数据」+ 脚注「K2 S1 暂无记录，按 0 画；不代表学生掌握度为 0。」；无记录学生 20250136 整块「暂无能力点数据」空态。
- 小坑：顶点 `<title>` 里写多个 JSX 子节点触发 React 警告（children 是数组）→ 改成模板字符串。另：3004 dev 的 `.pgdata-dev10` 被并发进程抢锁导致 PGlite init 失败，改 `.pgdata-dev14` 重建后恢复（未动 3001）。
