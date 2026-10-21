# 任务卡：data-api（后端 API / 会话 / 教师查询与导出）

## 目标（≤5 条）
1. 学生白名单登录 + 签名 cookie；教师口令解锁（HMAC-SHA256，7 天 httpOnly/lax）。
2. 实验会话 API：建 run（复用未完成）、批量事件提交（服务端重算 + 幂等落库）、交卷计分、run/报告读取。
3. 教师端查询 `lib/queries/teacher.ts` 四个函数（签名见 Lead 契约，teacher-console 直接 import）。
4. 名单管理（分页/导入/删除）+ 学情 CSV 导出（UTF-8 BOM，11 列）。
5. plans 存读接口；全路由 nodejs + force-dynamic，错误只返错误码。

## 独占写作用域
`app/api/**`、`lib/session.ts`、`lib/queries/**`、`lib/persist/**`、新增测试文件；`.team/**` 仅写本角色 notes/handoff/任务卡。

## 验收标准（全绿才算完）
- `npx tsc --noEmit` 本范围零错误；`npx eslint lib app/api` 0 error。
- `npx vitest run lib` 全绿，且新增覆盖：cookie 签名/篡改、事件批幂等、交卷与 scoring 一致、CSV BOM/转义、名单解析（表头/全角逗号）。
- 数据库测试用 `os.tmpdir()` 下的 PGlite 临时目录，不碰 `./.pgdata`。
- `npm run dev` 后 curl 走通全部路由，证据写入 `.team/notes/data-api.md`。
