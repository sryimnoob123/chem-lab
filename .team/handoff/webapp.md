# 交接 · webapp（2026-10-23 04:4x · 拼接实验主题 + AI 点评）

## 状态
`/plan` 的主题与点评都改完，本地 dev/prod 都能点，回归全绿，**未提交**（等钱家良发话）。

## 本轮改动（文件）
- `lib/plan/topics.ts`：4 主题（情境/目标/2~3 条可判约束/难度 1-2-2-3/featured/questions/rules）+ `applyTopic()` 同一张评分卡。
- `app/plan/topic-picker.tsx`、`plan.module.css`：难度刻度 + 两层文字卡；画布内 `topicHead` sticky。
- `app/plan/piece-library.tsx`：`featured` 下标即置顶顺序。
- `lib/plan/llm-assess.ts`：唯一点评入口（mock|coze|ark，12 s 上限，prompt 随主题变）；`lib/plan/assess-mock.ts` 新增（离线点评，point 必指 pieceId/ruleId）。
- 删除 `lib/plan/assess.ts` + `assess.test.ts`（写死实验名的旧链路）。
- `app/plan/designer.tsx`、`app/api/plan/assess/route.ts`、`lib/plan/rule-labels.ts`。
- `scripts/stub-llm.mjs`：本机 OpenAI 兼容 stub，验真实 provider 链路；`evidence/plan-ai/`：10 张截图 + README。

## 实测口径
- `npm run lint` 0 error / 20 warning（历史文件）；`typecheck` 干净；`test` 42 files / 607；`build` 通过。
- 干净浏览器会话 4 主题各走一遍 → `window.__errs` 为空。dev :3000 / 生产 :3001 均 200。
- 三档：100 分全过 / 95 分 warn（平行 2 份）/ 88 分 block（删分析天平）。
- 真 provider 用本机 stub 打通（标题「AI 点评」）；停掉 stub 会显示「AI 连不上，已用离线点评」。

## 待办
1. 真扣子豆包没连过（本机无 `COZE_API_TOKEN`/`COZE_BOT_ID`）；拿到凭据后按 `evidence/plan-ai/README.md` 起一次。
2. 素材块 `data-demo-id` 用 slug（`demo-design-piece-sodium-carbonate`），不是 pieceId——e2e 写错会静默落空。
3. 重 build 前先停 :3001/:3002（跑在 `.next/standalone` 里，否则 EBUSY）。

## 环境
- dev :3000（`npm run dev`）；生产 :3001（build 后手动复制 `.next/static`、`public`、`.env.production` 到 standalone）。
- 交互验证必须用 browser_exec（Playwright headless 访问 localhost 不 hydration）；长页面截图用 `cdp('Page.captureScreenshot', captureBeyondViewport=False)`。
