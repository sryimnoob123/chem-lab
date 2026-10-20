---
name: dsh-profile-and-skill-policy
description: Use when 在 dsh 里新建 profile、给项目挑 skill/插件，或判断某个 skill 该不该装——按模块拆分、判重叠、避开绑平台。
---

# 建 Profile 与选 Skill 的操作规则

## When to Use
- 要为本项目新建/调整 dsh profile
- 要决定装不装某个 skill 或插件
- 要判断现有 skill 集是否冲突、是否超编

---

## 1. 建 profile：按产线建，不按任务建

- 一个长期项目 = 一个 profile。临时任务**不要**新建 profile，开个会话就够。
- 命名用业务语义（`chemlab`、`webapp`），不用 `test1`/`new`。
- **不代替用户建 profile**。只给出命令，让他自己执行：

```bash
dsh web --from-default-profile chemlab   # 从官方 web 模板复制并启动
dsh --profile chemlab web                # 之后的启动方式
```

- 手动等价做法：把 `~/.dsh/profiles/desktop` 整目录复制成 `<name>`，改 `package.json` 的 `name`。
- `package.json` 的 `dsh.profile.bundles` 保持 `@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app`，改动前先说明理由。

## 2. profile 的四层分工（不要混）

| 层 | 位置 | 只放这些 |
|---|---|---|
| 工程约定 | 项目根 `AGENTS.md` | 语言栈、目录、代码规范、测试流程。唯一真源，Hermes 和 dsh 共用 |
| skill | `<项目>/.dsh/skills/` | 方法论、检查清单、流程。进 git |
| plugin | `dsh plugin --profile <name> add` | 运行时能力。一个插件 = 一份第三方代码 |
| 会话/记忆 | dsh 自管 | 不配置 |

**优先用 skill 解决；skill 表达不了的才装插件。**

---

## 3. 选 skill：六条判据，按顺序过

1. **先拆模块再找 skill。** 禁止「听说有个 skill 就装」。一个关注点配一个 skill；找不到就自己写，或干脆不要。
2. **来源分级。** 官方（Anthropic/Vercel/微软/Supabase/DeepSeek）> 知名作者 > 有星仓库 > 匿名仓库。**低于 100 星的仓库不装**，哪怕描述完全对口。
3. **安装量。** 用 `npx skills find <关键词>` 看 skills.sh 数字：>100K 可用；10K~100K 需看来源；<1K 必须完整读一遍 SKILL.md 再决定。
4. **查重叠并写明取舍。** 同关注点两个 skill = 两套冲突指令，模型会摇摆。留一个、删一个，在文档里记「留谁、砍谁、为什么」。已发生的取舍：
   - 留 `frontend-design`，砍 `sketch`（前者强制先出 design plan，后者只出一次性 mockup）
   - 留 `webapp-testing`，砍 `dogfood`（前者带服务器编排与证据链，后者泛化）
   - 留 `impeccable`，砍 `web-design-guidelines`（后者只查规范，实测跑完页面无变化）
5. **查是否绑死平台（最容易踩）。** 这三类直接跳过：
   - 依赖 Supabase 专有能力（Auth/RLS/Storage/Realtime）→ 我们跑裸 PG + 扣子
   - 依赖 Vercel/Netlify 部署语义 → 我们上扣子
   - 依赖 3D/WebGL → 本项目定的是 2D/SVG
6. **查可验证性。** 带脚本、带检测器、带断言清单的优先（`webapp-testing` 有 `with_server.py`，`impeccable` 有规则 CLI）；纯散文式「要做得好看」的排最后。

**数量上限 10~15 个。** 到 20 个必然互相打架。超了就按第 4 条砍。

---

## 4. 前端：按四层找，一次只补一层

| 层 | 触发条件 | 判定 |
|---|---|---|
| 视觉方向 | 从零做新页面 | 装。需要先定色值/字体角色/标志元素 |
| 结构布局 | 有设计稿 | 跳过 |
| 动效 | **只要有交互动画就必须有** | 装。缓动/时长/按下反馈全靠这层 |
| 质量规范 | 收尾阶段 | 只用来查规范，不指望它提升设计水平 |

本项目已选：
- `frontend-design` → 视觉方向。强制先输出 design plan（4~6 个命名色值、≥2 种字体角色、布局概念、1 个标志元素），禁 Inter/Roboto/Arial。
- `emil-design-eng` → 动效。硬规则：进场 `ease-out`（禁 `ease-in`）、常规交互 ≤300ms、按下 `scale(0.97)`、下拉从触发控件原点展开、模态框中心原点。

**前端硬约束：动画只动 `transform` / `opacity`。** 动 `width/height/top/left` 触发重排，SVG 场景必掉帧。

## 5. 后端：按五层找，别指望有现成鉴权 skill

| 层 | 用什么 |
|---|---|
| schema / 迁移 / 索引 | `supabase-pg-best-practices`（讲的是 PG 本身，适用于任何 PG；**不是** Supabase SDK） |
| 查询性能（N+1、全表扫描、连接池） | 同上 |
| 鉴权 / 越权 | **没有可信 skill，用下面的清单自查** |
| 文件存储 | 扣子对象存储，只同步 `coze_knowledge_base` 目录 |
| 部署 / 环境变量 / 迁移执行 | `coze-coding-webapp`（自写，扣子硬约束） |

**鉴权自查清单（每个新接口都过一遍）：**
1. 路由是否统一提取 token；无 token 是否 401。**禁止**「无 token 时降级读某个调试账号」。
2. 角色（学生/教师）是否在**服务端**校验，不能只靠前端隐藏按钮。
3. 带 `studentId` 之类参数的接口，是否校验「是不是本人」。
4. 全量导出类接口是否仅教师可访问。
5. dev 调试路由是否被环境变量闸门挡住。

---

## 6. 本项目技术栈（硬约束，不许自由发挥）

- 语言：TypeScript **strict**，不开 `any`（要逃用 `unknown` + 收窄）
- 框架：Next.js **App Router**，默认 Server Component，要事件/状态才 `'use client'`
- 样式：Tailwind v4 + CSS 变量；不引 CSS-in-JS、不引 UI 组件库
- 交互：**SVG + CSS transition/animation**（2D）；元素 >200 或需逐帧才 Canvas；不做 3D
- 数据库：PostgreSQL + Drizzle；本地 **PGlite**（WASM，零安装），生产接扣子托管 PG
- **禁用**：Supabase SDK / Firebase / MongoDB（扣子只有裸 PG，无 Auth/Storage/Realtime/RLS）
- 状态：显式状态机 `lib/engine.ts` + `useReducer`，不引 redux/zustand
- 测试：vitest（逻辑）+ Playwright（E2E）；三层流程见 `AGENTS.md`
- 部署：扣子 `code.coze.cn`，Git 只认 main，无 staging，一次就是生产

**为什么数据库写成裸 PG**：扣子部署时只同步 schema、不同步数据。要保证的是 schema/迁移干净，不是模拟数据量。用了 Supabase 专有能力，迁过去等于重写。

---

## 7. 装完必须验证（不许「装完就说好」）

1. 逐目录检查 `SKILL.md` 存在，且 frontmatter **同时**有 `name` 和 `description`——缺一个会被静默忽略（只有日志 warning）。
2. 确认会话工作目录 = 项目根，否则项目级 skill 不加载。
3. 给一个该 skill 管的具体任务，看它是否真按规则走（例：让它检查页面动效，看是否引用 `ease-out`/300ms 规则）。
4. 问一句「本项目代码规范第三条是什么」，答得出说明 `AGENTS.md` 加载了。

## 8. 禁止清单

- 禁止「先都装上试试」——互相打架比缺能力更糟。
- 禁止安装来源可疑的 skill：SKILL.md 全文会进上下文，里面写「忽略之前指令」是真实风险。
- 禁止同时维护 Hermes 和 dsh 两套完整栈：开发在 dsh，Hermes 只做验收/批量测试/跨机协调，共用同一项目目录与同一份 `AGENTS.md`。
- 禁止用 Docker 模拟扣子环境：差异在配额与平台行为（16MB 上传、90s 断连、3GB 沙箱、只同步 schema），模拟不出来。
- 禁止代用户建 profile、代装插件——只给命令，让他自己决定。
