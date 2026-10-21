# data-api notes（只追加，不改旧条目）

## 2026-10-20 19:08 · 完成：会话与白名单（A 段）
- 做了什么：`lib/persist/session-token.ts`（纯函数 HMAC-SHA256 令牌，`base64url(payload).sig`，timingSafeEqual，payload 前缀 `s:`/`t`）；`lib/session.ts`（`signIn/getStudent/signOut/requireStudent`、`unlockTeacher/isTeacher/requireTeacher/lockTeacher`，无密码白名单，cookie 7 天 httpOnly sameSite=lax）。
- 证据：`npx vitest run lib/persist/session-token.test.ts` 7 passed（签发/验签、篡改 payload/签名拒绝、换 SESSION_SECRET 失效、教师令牌不能当学生令牌）。
- 改了哪些文件：`lib/session.ts`、`lib/persist/session-token.ts`（新增）。
- 下一步 / 阻塞：无。

## 2026-10-20 19:09 · 完成：教师端查询（C 段，先落盘解 teacher-console 阻塞）
- 做了什么：`lib/queries/teacher.ts` 按 Lead 钉死签名导出 `getOverview / listStudents / getIncidentSummary / getStudentDetail`（后者 re-export 自 `teacher-detail.ts`）；`teacher-shared.ts` 放共用读模型（demo 过滤、完成度、最近活跃、run 聚合）。competency 输出 **0~100**（对齐 `components/teacher/types.ts`；`runs.score_detail.competency` 仍是 0~1）。
- 证据：`@ts-expect-error` 在 teacher-console 侧变为未使用（TS2578），对方删除即绿；已发消息确认。
- 改了哪些文件：`lib/queries/teacher.ts`、`lib/queries/teacher-detail.ts`、`lib/queries/teacher-shared.ts`。
- 下一步 / 阻塞：无。

## 2026-10-20 19:11 · 完成：名单管理 + CSV 导出（D 段）
- 做了什么：`roster-csv.ts`（表头可选、中英文逗号/制表符/全角空格、BOM、重复学号）；`roster.ts`（分页搜索、upsert 导入、删除白名单保留学情）；`csv.ts`（BOM + 转义 + 本地时间）；`export.ts`（11 列，列名见 Lead 确认版）；4 个 `/api/teacher/**` 路由。
- 证据：curl 导入 `{"imported":2,"skipped":0,"errors":[]}`（含表头 + 全角逗号行）；导出 CSV 首 3 字节 `efbbbf`，header=`学号,姓名,班级,实验,状态,完成度,操作分,报告分,总分,事故数,最近活跃`，42 数据行；DELETE 二次 404。测试：`csv.test.ts` 5 + `roster-csv.test.ts` 8 passed。
- 改了哪些文件：`lib/queries/{csv,roster-csv,roster,export}.ts`、`app/api/teacher/**`。
- 下一步 / 阻塞：无。

## 2026-10-20 19:13 · 完成：实验会话 API + 交卷 + 报告 + plans（B/E 段）
- 做了什么：`lib/persist/{replay,events,score,report,runs,plans,errors}.ts`；路由 `POST/DELETE/GET /api/session`、`POST /api/runs`、`POST /api/runs/[id]/events`、`POST /api/runs/[id]/finish`、`GET /api/runs/[id]`、`GET /api/report/[runId]`、`GET /api/experiments`、`POST /api/plans` + `GET /api/plans/[id]`、`POST /api/teacher/unlock`。全部 `runtime="nodejs"` + `dynamic="force-dynamic"`，错误统一 `{ok:false,error:"CODE"}`，无用户文案。
- 关键口径：state 由 timeline 重放（`apply` + `applyIncident` 补录，陷阱事故不会重复扣分）；timeline 幂等键 `(runId,stepIndex,seq)` + `onConflictDoNothing`；incidents 内存 + DB 双判重（DDL 无唯一索引）；交卷用 `lib/pedagogy/scoring.ts`，三段分各取整后 10/40/50 折算再取整（与导出口径一致）；plans 校验 pieces/issues/uuid。
- 证据：
  - `npx vitest run lib` → **334 passed / 17 files**（新增 23：session-token 7、csv 5、roster-csv 8、events 3）。
  - `npx tsc --noEmit` 零错误；`npx eslint lib app/api` 0 error（仅别人文件的 1 条 warning）。
  - curl：登录 403（冒名）/200（正确，种 `chem_sid`）；未登录建 run 401；exp01 → 404 `EXPERIMENT_NOT_PLAYABLE`；exp09 建 run 200 且二次复用同一 runId；陷阱动作 → `events=feedback,hint,incident,stateChanged`、incidents `exp09-H2/L3/-10`；重复提交 → `duplicate-action`、timeline 仍 1 条、incidents 仍 1 条；3 个正确动作 → `stepComplete`、`stepIndex=1`、observations=3；交卷 → `{pre:0,op:90,rep:27,total:50}`（op=100-10，total=0.4*90+0.5*27=49.5→50）；`GET /api/runs/[id]` 与 `/api/report/[runId]` 200；plans 存读 200；教师解锁错口令 401、正确 200；roster `total=40,loggedIn=35`。
  - `node scripts/check-encoding.mjs` → 编码检查通过。
- 改了哪些文件：`lib/persist/**`、`app/api/**`（新增）；未改任何禁改文件。
- 下一步 / 阻塞：无。测试临时库用 `os.tmpdir()` 随机目录并已清理，未碰 `./.pgdata`。

## 2026-10-20 19:22 · 修复：教师端 label 露出英文 id（teacher-console 反馈）
- 现象：demo seed 写的是 `timeline.choice_id = demo-<action>-<n>`、`incident_id = exp09-L<级别>-<编号>`，registry/定义文件都查不到 → 页面显示 wash/weigh、exp09-L4-001。
- 修复：新增 `lib/persist/labels.ts` 统一回落 —— `actionLabel()`：定义文件 choice.label → 17 个动作原语中文名；`incidentLabel()`：registry title → 演示 id 别名（6 条，与 seed INCIDENTS 对齐）→ 级别名（L1 偏差 / L2 数据作废 / L3 事故 / L4 危险事故）。接入 `teacher-detail.ts`、`teacher.ts`（事故分布 top）、`report.ts`（报告事故清单）。
- 证据：curl `/teacher` 与 `/teacher/student/20250101` 均 200，HTML 内出现「俯视读数 / 气泡未排尽 / 水入酸（热液喷溅）」；student 页时间线 label 显示「称量 / 滴定 / 读数 / 计算」。`tsc` 零错误、`eslint lib app/api` 0 error、`vitest run lib` 334 passed。
- 后续（非本轨道强制）：`db/seed-demo.mjs` 的 owner 若把 incident id 改成 registry 的 `exp09-H<n>`、choiceId 写成真实定义 id，`labels.ts` 里的 LEGACY 映射可删。
- 改了哪些文件：`lib/persist/labels.ts`（新增）、`lib/queries/teacher-detail.ts`、`lib/queries/teacher.ts`、`lib/persist/report.ts`。

## 备注（给验收的人）
- `npx tsc --noEmit` 若报 `.next/dev/types/validator.ts` 的 `/experiments`，是别人新增页面后 dev 类型未重生成：`curl localhost:3000/experiments` 触发编译后再跑即绿（已复现并验证）。
- 教师端/学生端调用：`GET /api/session` 可查当前登录学生（未登录 401）。

## 2026-10-20 19:16 · 收尾：分层解耦 + 最终复验
- 做了什么：`AuthError` 下沉到 `lib/persist/errors.ts`（`lib/session.ts` re-export，对外入口不变），`lib/persist/runs.ts` 不再 import `lib/session`（避免持久层把 `next/headers` 拖进非请求上下文）；`app/api/_lib/http.ts` 直接从 errors 取。
- 证据：`npx tsc --noEmit` 零错误；`npx eslint lib app/api` 0 error；`npx vitest run lib` 334 passed / 17 files；curl 复验 `/api/session` 401、`/api/experiments` 200、`/api/teacher/roster` 200（total=40）；`node scripts/check-encoding.mjs` 通过。
- 改了哪些文件：`lib/persist/errors.ts`、`lib/persist/runs.ts`、`lib/session.ts`、`app/api/_lib/http.ts`。
- 下一步 / 阻塞：无，本轨道交付完成；联调问题可继续发给 data-api。

## 2026-10-20 19:34 · 事故处理：.pgdata 打不开 / 教师端查询全挂（已恢复）
- 现象（teacher-console 19:28 报）：`/teacher` 200 但错误态 `Failed query: select "student_no" from "students"`；`/api/experiments` 也 500（连 experiments 表都没有）。我排查：数据文件停在 19:12、`postmaster.pid` 是 19:19:43 的 **0 字节**、dev 在 19:26 被重启，之后库就打不开。
- 根因判断：**PGlite 独占目录被并发打开/未正常关闭**（19:19 有进程在 dev 未停时碰了 `.pgdata`，留下坏锁；19:26 新 dev 拿到坏目录）。确认不是本轨道跑的（我只跑 vitest 临时库 + curl）。dev 停掉后 `node db/init.mjs` 依旧 `RuntimeError: Aborted()`，说明数据目录本身已损坏，不只是句柄。
- 处置：`mv .pgdata %TEMP%\pgdata-broken-193150`（保留现场）→ `node db/init.mjs`（10 实验）→ `node db/seed-demo.mjs`（40 人：26 完成 / 9 进行中 / 5 未开始）→ 分离进程重启 dev（日志 `%TEMP%\chemlab-dev.log`）。注意 `Stop-Process` 杀不掉 next 的进程树，要用 `taskkill /T /F`。
- 证据：`/api/experiments` 200（10 条）、`/api/teacher/roster` 200（total=40, loggedIn=35）、`/teacher`、`/teacher/roster`、`/teacher/student/20250101` 全 200，HTML 含「俯视读数 / 气泡未排尽 / 水入酸（热液喷溅）」「称量 / 滴定 / 读数 / 计算」，无 `Failed query`。
- 全队红线：**dev 在跑时不许跑 `db/init.mjs` / `seed-demo.mjs` / 直连 `.pgdata` 的脚本 / e2e 另起 dev**；要独立库就把 `PGLITE_DIR` 指到临时目录（`lib/persist/events.test.ts` 就是这么做的）。
- 改了哪些文件：无源码改动；`.pgdata` 已重建，`db/**` 未改。

