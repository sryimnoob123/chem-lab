# dsh profile `chemlab` 配置说明与决策记录

> 2026-10-20 ｜ 面向 chem-lab 项目的 dsh 专用 profile
> 目的：让接手开发的人（或 agent）知道这个 profile 里装了什么、为什么装、为什么不装别的。

## 怎么启动

```powershell
# dsh CLI 不在 PATH，桌面版入口在这：
$dsh = "E:\TOOLS\dsh\resources\runtime\cli\bin\dsh.cmd"

# 工作区必须选 chem-lab，否则项目级 skill 和 AGENTS.md 不生效
cd E:\workspace\public\NOBBBB\chem-lab
& $dsh --profile chemlab            # 打开 Web UI（自动分配端口，打印带 token 的 URL）
& $dsh --profile chemlab --port 39001 --no-open   # 指定端口、不开浏览器
```

`--profile chemlab` 之后**不要**再跟 `web`（会报 `too many arguments`）；app 参数（`--port` / `--no-open`）直接跟。

## 分层结构（别混）

| 层 | 位置 | 内容 |
|---|---|---|
| 工程约定 | 项目根 `AGENTS.md` | 语言栈、目录、规范、三层测试、**并行作战方式与 DDL** |
| 项目 skill | `chem-lab/.dsh/skills/`（15 个） | 方法论与检查清单，进 git |
| 全局 skill | `~/.dsh/skills/`（20 个） | 同样这 13 个通用 skill 的副本，桌面端任何工作区都能用 |
| profile | `~/.dsh/profiles/chemlab/` | bundles、插件、MCP、模型配置 |
| desktop 档 | `~/.dsh/profiles/desktop/` | 你日常用的 Electron 档，本轮已同步同一套能力 + 新增 `preset-chemlab` |
| 备份 | `~/.dsh/profiles/chemlab.bak-20261020/` | 改坏了的还原点 |

## desktop 档对齐（2026-10-22）与本轮新增

桌面端（Electron）用的是 `desktop` 档，不是 `chemlab` 档，所以这套能力重复做了一份进去：

| 补进 desktop 的东西 | 说明 |
|---|---|
| `@michengai/dsh-code-review`、`billion-context`、`dsh-checkpoint-rewind`、`dsh-diff-approval` | 4 个插件，装完技能目录立即刷新（热加载生效） |
| `agent-team` maxMembers 20 / maxTasks 512 | 与 chemlab 一致 |
| MCP `context7` | Next 16 / React 19 / Drizzle 实时文档 |
| 显式禁用 `experimental-inspector`、`session-inspector` | 与 billion-context 抢 `fetch`，不禁会报 `1 entry did not activate` |
| **`preset-chemlab`**（新预设） | 桌面端预设选择器里出现，名字「chem-lab · Web 应用开发」，order 5 |

`preset-chemlab` 是从 `~/.dsh/cordis.patch.yml` 的 `preset-standard` 整块抄下来改的（Cordis patch **不深合并**，覆盖 `config` 必须整段重述），并且把里面 `tool-plugin-manager` / `tool-plugin-market` 的 `disabled` 从 `true` 改成 `false`，这样这个预设下能直接装插件。

> ⚠️ 预设改名后**要重启桌面端 app** 才在预设选择器里出现。已有会话保持它启动时的插件版本，新预设要在新会话里验证。

### 校验 desktop 档的办法（CLI 不给看）

`dsh --profile desktop --dump-config` 会直接报错：
```
error: profile "desktop" is managed exclusively by the Electron application
```
所以要校验 desktop 的 patch 有没有写坏，用一个**一次性镜像 profile**：把 `cordis.patch.yml` / `cordis.yml` / `package.json` / `pnpm-workspace.yaml` 复制到临时 profile，用 `mklink /J` 把 `node_modules` 软链过去，改掉 package.json 里的 name，然后 `--dump-config`。验完删掉（含软链要用 `cmd /c rmdir` 解，不能直接 `Remove-Item`）。

> 踩坑：`Set-Content -Encoding UTF8` 在 Windows PowerShell 5 会写出 **BOM**，dsh 读 package.json 报 `SyntaxError: Unexpected token '﻿'`。手写这些文件必须用 `[IO.File]::WriteAllText(..., UTF8Encoding($false))` 或 `-Encoding utf8NoBOM`。

## 已装（6 个第三方 bundle + 2 个官方 bundle）

| 装了什么 | 版本 | 社区数据 | 解决哪块 |
|---|---|---|---|
| `dshmarket` | 1.66.42 | 30 天 620,408 下载 / 6,775★ | 设置页里的插件市场，后续自己找插件 |
| `billion-context` | 0.1.201 | 1,784,926 下载 / 2,025★（全站第一） | 长会话上下文压缩（模型窗口 1M，但项目会读大量 SVG/代码） |
| `dsh-checkpoint-rewind` | 0.6.31 | 5,507 下载 / 27★ | `/checkpoint` `/rewind`：会话+工作区+**配置**三态快照，改坏了能退 |
| `@michengai/dsh-code-review` | 1.0.1 | 63,304 下载 | `/review`：独立子 agent 只读审 diff，主会话不被污染 |
| `dsh-builtin-browser` | 0.4.13 | 21,325 下载 / 126★ | 打开 localhost、截图落盘、无障碍树、evaluate |
| `dsh-diff-approval` | 0.36.0 | 6,011 下载 | 逐文件 diff 审批台，可导入工作区 Git 改动（`/review` 缺的那块玻璃） |
| `@deepseek-ai/dsh-experimental-agent-team-profile` | 内置 0.2.1-rc.2 | — | **多 agent 并行**：spawn_teammate / team_task_* / wait_agent |
| `@deepseek-ai/dsh-experimental-inspector-profile` | 已移除 | — | 与 billion-context 冲突（`globalThis.fetch is an accessor`），启动报 1 entry 未激活，故移除 |

## MCP（4 个）

| server | 传输 | 用途 | 备注 |
|---|---|---|---|
| `browseros-neo` | streamable-http `127.0.0.1:9010` | 真实登录态浏览器 | **不要**用它开 localhost |
| `magpie-search` | streamable-http `127.0.0.1:3425` | 联网搜索 | 沿用 desktop 配置 |
| `context7` | streamable-http `mcp.context7.com/mcp` | Next 16 / React 19 / Drizzle 实时文档 | 2026-10-20 实测 200（Context7 4.4.3） |
| `playwright` | stdio（绝对 node + cli.js） | **只**用于移动端视口 390×844、trace 录制、网络断言 | 加 `--isolated --headless`，避免和 neo 抢浏览器 |

## 明确不装（调研过，别重复调研）

| 候选 | 为什么否 |
|---|---|
| `dsh-agent-teams`（交接文档提到） | **npm 上不存在（404）**；官方内置 agent-team 已覆盖 |
| `dsh-claude-move` | 29★；本项目没有 Claude/Codex 会话要迁 |
| `dsh-vision-router` 等视觉桥 | 模型本身能读图（实测截图后能准确说出颜色/文字/位置），它默认把图发到云端兜底，且截图只吃本地 HTML 文件，不解 localhost |
| `@goodandready/dsh-live-canvas` | 渲染的是 agent 生成的 HTML，不是 dev server 上的页面；3★、无 dsh 兼容声明 |
| `@changfenhuang/dsh-genui` / `dsh-mermaid` | 是"展示"不是"验收"；genui 内置 3D，项目不做 3D |
| `impeccable` | ~~与 `frontend-design` 同源高重叠~~ **已装**（用户 2026-10-22 明确要求，见下节） |
| `dsh-db-tool` / `dsh-sql` / `dsh-database-explorer` / `dsh-db-connector` | **连不上 PGlite**（它不是网络服务）；真 PG 用 `psql` 更可编程（有退出码）。`dsh-db-tool` 还要给宿主打二进制补丁 |
| `@modelcontextprotocol/server-postgres` | 已归档废弃，且有未修补的 SQL 注入（`COMMIT; DROP SCHEMA`） |
| `@bytebase/dbhub` 等 PG MCP | 同样连不上 PGlite；开发期用 drizzle-kit 的 `driver: "pglite"` 更直接 |
| `dsh-context` / `dsh-context-compression-improved` / `dsh-plugin-save-token` | 与 billion-context 打架（双压缩）、版本硬枚举、已停更 |
| `@feng0531/dsh-code-review` / `dsh-file-review` / `dsh-auto-review` | 与已装 `/review` 重复 / 版本硬钉 / 实为审批闸门不是评审 |
| `@goodandready/dsh-time-machine` / `@domitor-syh/dsh-rollback` | 1★ / 4★，且只做工作区，不如已装的三态快照 |
| `dsh-swarm-orchestrator` / `@nanmicoder/dsh-agent-teams` / `@linxin666/dsh-client-ui-task-board` | 与内置 agent-team 重复；task-board 是 cron 无人值守，不是并行协作 |
| `dsh-mneme` / `meow-memory` / `hindsight` | 自动注入会破坏 prompt 缓存、与压缩器抢预算；两天项目用 `docs/` 当记忆更可控 |
| `dsh-vps` / `cloudbase` / `dsh-plugin-deploy` | 本项目唯一部署动作是 push main 后由扣子构建，与本机插件正交 |

## 已验证的 profile 级设置

| 设置 | 值 | 作用 |
|---|---|---|
| `working-directory.defaultDirectory` | `E:\workspace\public\NOBBBB\chem-lab` | **profile 一开工作区就是项目根**，项目级 AGENTS.md 与 `.dsh/skills` 自动生效，不用每次手动选文件夹 |
| `agent-team.maxMembers` | **20**（默认 8→schema 默认 16） | 频繁并行开 agent 团队提速；常规 6~10，赶节点可到 16~20 |
| `agent-team.maxTasks` | 512 | 团队任务板上限 |
| 单轮并行工具调用 | 约 10（内置默认，未改） | 需要更多就分批，或用 `workflow` 扇出 |

## 飞书（手机端问询）+ 多端同时弹

你会在外面换办公地点，所以提问要能到手机。

| 项 | 状态 |
|---|---|
| `@aiwayds/dsh-feishu` 0.16.0 | 已装进 **chemlab**（desktop 本来就有）；出站 WebSocket，不开端口、不要内网穿透 |
| `@aiwayds/dsh-ask-router` 0.6.0 | 已装进 **chemlab 和 desktop**（desktop 需重启 app 生效）；让 `ask_user_question` **同时**弹飞书卡和桌面 UI，**先答先得**，另一端自动收起 |
| 凭据 | ⚠️ **还没有**。`~/.dsh/.credentials.yaml` 里没有 `DSH_FEISHU_APP_ID/SECRET`，所以 bot 现在是休眠状态 |
| 配置 | chemlab patch：`mode: on`、`domain: feishu`、`backgroundPush: all`（每个回合结束都推手机）、`operators: []` |

**你需要做一步（只有人能做的）**：在 dsh 的输入框里跑 `/feishu-onboard`，按提示扫码创建企业自建应用。
它会自动把凭据写进 `~/.dsh/.credentials.yaml`（所有 profile 共用）、把扫码的人加进管理员、并热激活；
启动日志出现 `dsh-feishu: armed (1 operator(s), feishu)` 就是成功。**不要把 App Secret 贴进对话**。

注意两条：
- 飞书 bot 是**单实例**（同一时刻只有一个 dsh 进程能持有），所以别同时开 desktop 和 chemlab 两个实例都指望它；后启动的那个会静默休眠。
- `backgroundPush: all` 会在每个回合结束时推手机；嫌吵就改成 `cron`。

## 验证记录（2026-10-20）

- `--dump-config`：1446+ 行，6 个第三方 bundle 全部挂载，4 个 MCP 全部在树里
- 启动：`dsh web: http://127.0.0.1:39xxx/?token=...`；HTTP 401 = 鉴权门（服务正常）
- 移除 inspector 后启动**无任何 warning**（之前有 `1 entry did not activate`）
- 已装插件版本比 npm 最新落后 1~2 个小版本（如 checkpoint-rewind 0.6.31 vs 0.6.33）——**冲刺期冻结升级**，别在 DDL 前动

## 已知风险 / 待办

1. `billion-context` 是权限最重的插件（`credentials` + `llm` + `shell`），注册表标了 plaintext http 标记。本地扫描只见到 `localhost` 与一个 `http://billion-context.inline` 占位符，未见真实外发端点；**冲刺结束后复查它的出网行为**。
2. 它要求把 preset 切成 `standard-bili-auto-off` 以关掉原生自动压缩，避免"双压缩"——在 Web UI 的模型/preset 设置里切一次即可。
3. **冲刺期不要升级 dsh 本体**：`@michengai/dsh-code-review` 的 peer 逐条钉 `0.2.1-rc.2`，升级会让 `/review` 直接加载失败。
4. `E:\TOOLS\pgsql\bin` 不在 PATH；验 DDL 时临时 `$env:Path += ';E:\TOOLS\pgsql\bin'`。
5. 项目 `drizzle.config.ts` 目前没写 `driver: "pglite"`，所以 `drizzle-kit` 打不开 `.pgdata` —— 需要项目侧补一行（3 分钟的事，交给开发任务）。
