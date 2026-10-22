# 拼接实验 · 主题 + AI 点评验收证据（2026-10-23 04:4x）

## 结论（先看这段）

- **只有一条点评链路**：`POST /api/plan/assess` → `lib/plan/llm-assess.ts`（provider `mock | coze | ark`）
  → 离线时用 `lib/plan/assess-mock.ts`。旧的 `lib/plan/assess.ts`（`buildPrompt` 里把实验名写死成
  「盐酸标定 + 纯碱双指示剂」）连同它的测试已删除，不再两套并存。
- **prompt 随主题变**：主题标题 / 情境 / 目标 / 该主题约束 + `ruleCode` / 学生放入的块（顺序即流程）/
  参数 / 规则引擎判定 / 未通过与已通过清单 / 写作要求，全部进提示词。原文见
  `scripts/stub-llm-requests.log`（stub 端点记录的最后一笔就是真实发出的 body）。
- **没有凭据就走 mock，永不 throw**：`COZE_API_TOKEN` + `COZE_BOT_ID` → 扣子 v3 chat（发起 → 轮询 → 取 message）；
  `COZE_LLM_URL` + key（或 `ARK_API_KEY` / `DEEPSEEK_API_KEY`）→ OpenAI 兼容端点；都没有 → mock。
  超时 12 s 封顶，超时 / 限流 / HTTP 错误 / 空回复 / 坏 JSON / 连不上，一律回退本地点评，UI 用一行小字写明原因。
- **mock 不是「写得不错继续加油」**：每条 point 都带 `pieceId` 或 `ruleId`（「还缺『分析天平』：…」这类），
  questions 取自主题追问池，最多 2 条。

## 截图（本目录）

| 文件 | 证明什么 |
|---|---|
| `00-topic-picker.png` | 四张主题卡有**难度梯度**：入门 1 格 / 进阶 2 格 / 进阶 2 格 / 综合 3 格；每卡只有「情境一句 + 2~3 条硬约束」两层文字 |
| `01-topic-hcl-standard-pass.png` | 主题 01：选主题 → 载入参考方案 → 100 分、24 条规则全过、离线点评 |
| `02-topic-acid-acceptance-pass.png` | 主题 02：把参考方案的 Na₂CO₃ 换成 KHP 后 100 分（不换时是 88 分「1 条硬约束没过」，主题规则真的在判） |
| `03-topic-co2-blank-pass.png` | 主题 03：CO₂ 专项，点评点到「新沸冷却蒸馏水」「煮沸驱 CO₂」 |
| `04-topic-soda-alkalinity-pass.png` | 主题 04：综合档，双指示剂 + 空白 + 煮沸 |
| `06-tier-pass.png` | 三档之一：全过（100 / 100，结论「结构和顺序都对」） |
| `07-tier-warn.png` | 三档之二：平行次数改成 2 → 95 分，结论「能执行，但有 1 处会掉分。先处理「平行测定」。」 |
| `08-tier-block.png` | 三档之三：删掉分析天平 → 88 分，「方案现在做不了：1 条硬约束没过」 |
| `09-real-provider-ark.png` | **真实 provider 链路**：`PLAN_ASSESS_PROVIDER=ark` + `COZE_LLM_URL` 指向本机 stub，标题显示「AI 点评」，正文 / 要点 / 追问都来自模型返回的 JSON |
| `10-provider-down-fallback.png` | 把 stub 停掉再改方案 → 「AI 连不上，已用离线点评。」，本地要点照常显示（不白屏、不跳版） |

## 复现

```bash
# 开发（mock 缺省）
npm run dev                              # http://localhost:3000/plan

# 生产构建
npm run build && mkdir -p .next/standalone/.next \
  && cp -r .next/static .next/standalone/.next/static \
  && cp -r public .next/standalone/public \
  && cp .env.production .next/standalone/.env.production
cd .next/standalone && PORT=3001 HOSTNAME=127.0.0.1 PGLITE_DIR=../../.pgdata-prod2 node server.js

# 真实 provider 链路（本机无扣子凭据时用 stub 证明「配好就会用模型」）
node scripts/stub-llm.mjs 8899           # 另开终端
cd .next/standalone && PORT=3002 HOSTNAME=127.0.0.1 PGLITE_DIR=../../.pgdata-stub \
  PLAN_ASSESS_PROVIDER=ark COZE_LLM_URL=http://127.0.0.1:8899/v1/chat/completions \
  COZE_LLM_KEY=stub-key node server.js   # http://127.0.0.1:3002/plan

# 接真豆包（扣子）
COZE_API_TOKEN=... COZE_BOT_ID=... npm run start
# 或 OpenAI 兼容：COZE_LLM_URL=https://ark.cn-beijing.volces.com/api/v3/chat/completions ARK_API_KEY=...
```

点测清单：`/plan` → 选主题卡 → 左栏「载入参考方案」（或自己点块）→ 顶部评分卡 → 右栏「方案点评」；
把「平行测定份数」改成 2 看 warn 档，删掉「分析天平」看 block 档；点评标题右侧小字应显示「离线点评」或「AI 点评」。

## 命令证据（2026-10-23 04:4x）

- `npm run lint` → **0 errors** / 20 warnings（20 条全是历史文件，`lib/plan/*`、`app/plan/*` 均为 0）
- `npm run typecheck` → 无输出（0 error）
- `npm run test` → **42 files / 607 tests passed**
- `npm run build` → 通过（Next 16.4.2），本地生产 `:3001` 与 dev `:3000` 均 200
- 浏览器实测：干净会话把 4 个主题各走一遍，`window.__errs` 为空（0 error / 0 unhandledrejection / 0 console.error）

## 边界（别当成已完成）

- 真扣子豆包**没连过**（本机没有 `COZE_API_TOKEN` / `COZE_BOT_ID`）：扣子 v3 的「发起 → retrieve → message/list」
  走单测（打桩 fetch 覆盖轮询中/失败/超时），真实网络链路用本机 OpenAI 兼容 stub 打通。
- 素材库只对主题 `featured` 置顶，其余块**仍然可选**（故意留错让学生踩）。
- 三档里 warn/block 是用「平行份数」「删分析天平」做出来的，没为演示另造假数据。
