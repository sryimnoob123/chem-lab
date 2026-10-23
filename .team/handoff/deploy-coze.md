# 部署到扣子编程 · 交接清单（2026-10-23）

> 本地已验收、代码已推到 GitHub `main`：`sryimnoob123/chem-lab`。
> 扣子只认 main，不要建分支。全部改动在最新 main 上。

## 0. 这次要接的两条 AI 链路（都在后台，前端已经调好）

| 用途 | 接口 | 谁在调 | 没配模型时 |
|---|---|---|---|
| **拼接方案评分 + 点评** | `POST /api/plan/assess` | `/plan` 页面（提交方案后） | 回落规则分，评分卡标「规则校验」 |
| **AI 助教对话** | `POST /api/tutor/chat` | 操作台右下角机器人 | 回落本地话术「还没接上大模型…」 |

两个接口共用同一套 provider（`lib/plan/llm-assess.ts`），**配一次 key 两处都通**。

`/api/plan/assess` 的返回（前端已按这个渲染）：
```json
{
  "ok": true, "provider": "ark", "llm": true,
  "score": 88,              // 最终分：模型给的（服务端已按规则封顶）
  "scoreSource": "llm",     // llm = AI 评分；rule = 没模型时回落规则分
  "dimensions": [{"name":"顺序","score":90,"note":"润洗在转移前"}],
  "text": "…", "points": [...], "questions": [...],
  "ruleScore": 91,          // 规则分，仅排查用
  "feasible": true
}
```
封顶规则（防止模型客气）：方案不可执行或违反硬约束 → 最高 59；有扣分项 → 最高 84。

## 1. 在扣子「发布管理」里加的环境变量

**必须有（否则线上接口 500）**

| 变量 | 值 |
|---|---|
| `DATABASE_URL` | 平台数据库连接串（`postgres://…`）。平台若已自动注入 `COZE_PG_*` 就不用手填 |

**接大模型（二选一）**

> 扣子平台的自定义环境变量**不能用 `COZE_` 前缀**（系统保留），所以下面给了不带前缀的别名，两套都认。
> 平台不会自动注入任何模型凭据（2026-10-23 容器实测：无 BOT_/LLM_/ARK_ 变量）。

| 方案 | 变量 |
|---|---|
| 扣子 BOT（官方通道，推荐） | `BOT_TOKEN`（个人访问令牌 PAT）+ `BOT_ID`（BOT 的 bot_id；BOT 必须先「发布」到 API 渠道） |
| OpenAI 兼容（火山方舟） | `LLM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3/chat/completions` + `LLM_API_KEY` + `LLM_MODEL=doubao-seed-1-6-flash` |
| 只要方舟 key | `ARK_API_KEY`（自动补方舟地址）、可选 `ARK_MODEL` |
| 只要 DeepSeek key | `DEEPSEEK_API_KEY`、可选 `DEEPSEEK_MODEL` |

老名字也仍然可用：`COZE_API_TOKEN`/`COZE_BOT_ID`/`COZE_LLM_URL`/`COZE_LLM_KEY`/`COZE_LLM_MODEL`（本地 `.env.local` 里随便写）。
可选：`PLAN_ASSESS_PROVIDER=auto|coze|ark|mock`（缺省 auto，按凭据自动判断）。

BOT 侧设置要点：单 Agent、把「严格按用户给的 JSON 格式输出，不要 Markdown」写进人设；`/api/plan/assess` 的提示词已经把 JSON schema 发过去了。
接口是异步的（发起 → 轮询 → 取答案），我们的超时是 12 秒，BOT 回复要在 10 秒内。

**注意**：生产变量只能在「发布管理」改，**改完必须重新部署才生效**；同名 key 已存在时先删再建。

## 2. 部署前

1. 扣子仓库里 `git fetch origin main && git reset --hard origin/main`，确认 `git log --oneline -1` 是最新提交（当前 `fe02343`）。
2. **建表（最容易漏的一步）**：代码运行时不自动建表，生产库首次部署是「按开发库 schema 建」——
   所以**开发库必须先有表**，否则线上 `relation ... does not exist`。在扣子容器（开发环境）里执行一次：
   ```bash
   node db/init.mjs        # 幂等：DDL 来自 db/migrations/0001_init.sql，同时播种 10 个实验元数据
   node db/seed-demo.mjs   # 可选：40 名学生 + 演示 run（演示要用就带上）
   ```
   前提是开发环境已注入 `DATABASE_URL`（发布管理里配的那套开发变量）。
3. 首次部署：勾「同步数据」把开发库的数据带过去；**之后每次部署只同步 schema、不动数据**，回滚也不回滚数据库。
4. 线上容器文件系统只读 → 必须走真 PG（见上表），否则会回落 PGlite 报 EROFS。

## 3. 部署后自检（按顺序打，任一不过就停下）

| 检查 | 命令/地址 | 期望 |
|---|---|---|
| 数据库宿主 | `GET /api/health` | `dbMode: "postgres"`（出现 `pglite` = 没注入，回去配 `DATABASE_URL`） |
| 表结构 | `/api/health` 的 `counts` | 主表能数出行数，不是 `relation does not exist` |
| AI 评分 | 打开 `/plan` → 选主题 → 拼方案 → 提交 → 看评分卡左上角标签 | 显示「AI 评测」+ 分项；没配模型时显示「规则校验」（说明 key 没生效） |
| AI 助教 | 操作台右下角机器人 → 问一句 | 回的不是「还没接上大模型…」那句兜底 |
| 实验台 | `/exp/exp01` → 拖容量瓶进洗涤槽 | 冲水刷洗 → 倒水排空 → 器皿滑回原位（不卡在槽里） |
| 教师端返回 | `/teacher/roster` → 左上「← 返回」 | 回到 `/teacher`（不是学生端）；在 `/teacher` 首页时那一项写「学生端」 |

## 4. 扣子上会咬人的几条（已踩过）

- **只读文件系统**：任何写本地文件的逻辑都会 EROFS；数据库必须是平台 PG。
- **HTTP 90 秒无数据交互就断**：现在没有 SSE，全部是短请求，不受影响；以后加流式对话必须 85s 心跳。
- **上传 16MB 上限**：当前没有文件上传功能。
- **沙箱 3GB / 1 小时空闲回收**：构建超内存就先 `npm ci` 再 build，别在容器里跑 e2e。
- **内容审核**：实验事故文案（爆炸/中毒一类）已在本地验收过，属教学演示；如审核卡住，先把事故文案改成"操作失误演示"。
- `coze code repo pull` 不可靠：判据是 `deploy status` 的 `commitHash` 有没有变；没变就让容器自己 `git reset --hard origin/main`。

## 4.5 AI 助教 / AI 点评：**没有真 key 时怎么自证链路是通的**（2026-10-24 实测）

不用申请任何 key、不用连外网：在本机起一个假的 OpenAI 兼容端点，把服务指过去，看回复是不是它给的。

```bash
# ① 假端点（临时脚本，只回一句带标记的话；port 4567）
node mock-llm.mjs        # → {"choices":[{"message":{"content":"【MOCK-LLM-OK】…"}}]}

# ② 带凭据起服务（COZE_LLM_URL 指向假端点；KEY 随便填，只要有值就会被当成「已配置」）
PORT=3001 HOSTNAME=127.0.0.1 PGLITE_DIR=<repo>/.pgdata-prod2 \
COZE_LLM_URL=http://127.0.0.1:4567/v1/chat/completions COZE_LLM_KEY=test-key \
node .next/standalone/server.js

# ③ 登录 + 问一句
curl -s -c /tmp/ck.txt -X POST localhost:3001/api/session \
  -H 'content-type: application/json' -d '{"studentNo":"20250101","name":"周若曦"}'
curl -s -b /tmp/ck.txt -X POST localhost:3001/api/tutor/chat \
  -H 'content-type: application/json' \
  -d '{"question":"移液管怎么润洗","step":"定容","experimentId":"exp01"}'
```

两种结果（下面两行是 2026-10-24 的**原始回执**，不是改写）：

| 场景 | 回执 |
|---|---|
| 有凭据（指向假端点） | `{"ok":true,"llm":true,"provider":"ark","reply":"【MOCK-LLM-OK】先把移液管润洗三次，再移取 25.00 mL。"}` |
| 没有凭据（正常启动） | `{"ok":true,"llm":false,"provider":"mock","fallback":"offline","reply":"这会儿没答上来。这一步叫「定容」，做法在右侧「看原因 / 提示」里。"}` |

判据三条：① 有凭据时 `llm:true` 且 `reply` 是你假端点里那句话（说明真走了 HTTP 模型调用，不是本地兜底）；
② 没凭据时 **HTTP 仍是 200**、`fallback:"offline"`、`reply` 是本地话术（说明降级不报错，学生看到的是一句人话而不是红字）；
③ 全过程日志里没有 5xx。AI 点评（`/api/plan/assess`）用的是同一套 provider，配一次 key 两处都通。

## 5. 本地这一版已经验过的（可复跑）

```bash
npx tsc --noEmit                       # 0 error
node node_modules/eslint/bin/eslint.js components app lib   # 0 error / 14 warning（既有）
npx vitest run                         # 44 files / 622 tests
npx playwright test e2e/wash-return.spec.ts  # 3 passed（洗涤→倒水→回位、回位不瞬移、无效洗涤也回位）
```
`lib/plan/llm-score.test.ts` 里有两条**真起 HTTP 端点**的用例：模型返回 `score:92` → 落 92；
模型给 96 但方案不可执行 → 被压到 59。接口真的接得上模型，不是只有 mock。
