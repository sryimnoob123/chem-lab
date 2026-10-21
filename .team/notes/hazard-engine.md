# hazard-engine · notes（只追加）

## 2026-10-20 18:35 · 完成：安全层四件套 + 73 条单测
- 做了什么：
  - `lib/safety/hazards.ts`：规范条目库 24 条。S001~S009 严格照 `docs/实验库/exp09.md` §5（守则/玻璃/腐蚀试剂/滴定管/滴定操作/读数/移液管/废液储存/事故报告）；S010~S024 为跨实验通用条目（通风橱、重金属废液、浓酸稀释、加热暴沸、热器皿骤冷、滴加移液、严禁口吸、离心配平、天平超载、电学仪表、银氨现配、试剂定点取用、废液分类、有毒气体撤离）。每条含 `id/title/requirement/scenes/source/domain/review="【待老师核】"`，并导出 `HAZARD_INDEX/getHazard/hasHazard/missingHazardIds/hazardsForScene`。
  - `lib/safety/incidents/types.ts`：契约 §1/§2/§3/§5 的类型镜像（`Action/EntityState/ExperimentState/IncidentLevel/FxKey/Incident`），`FX_KEYS` 常量（8 个键，顺序与合同 §11 一致），`LEVEL_RULES` 四级扣分表 + `isDeductInRange`，判定工具 `onStep/paramTrue/paramEquals/numParam/choiceHas/anyOf`（全纯函数）。多加两个可选字段：`stepNo`（1-based，规格步号）、`fxSilent`（L1/L2 无动画）。
  - `lib/safety/incidents/exp09.ts`：14 条事故，逐条对应规格 §7 的 exp09-H1~H14。分布 L4×1 / L3×3 / L2×6 / L1×4；扣分 20/10/9/8/5×6/3×4；四类硬要求事故齐全（boil-over L4、burn L3、glass-break L3、device-accident L3）。
  - `lib/safety/registry.ts`：`INCIDENTS_BY_EXP`、`getIncidents/getIncident/incidentCount`、`detectIncidents`（全部命中，声明序）、`detectFirstIncident`（L4>L3>L2>L1，同级取先声明，确定性）、`validateRegistry()`（id 唯一/格式、扣分区间、L4 必 terminate、refs 存在、fx 合法、fxSilent 只用于 L1/L2、文案非空、stepNo 合法）。
  - 单测 3 个文件：`hazards.test.ts`(9) / `incidents/exp09.test.ts`(56) / `registry.test.ts`(8)。
- 证据：
  - `npx vitest run lib/safety` → **Test Files 3 passed / Tests 73 passed**
  - 单文件域 typecheck：`npx tsc --ignoreConfig --noEmit --strict ... lib/safety/**.ts` → exit 0
  - `npx eslint lib/safety --max-warnings=0` → exit 0
  - 全仓 `npx tsc --noEmit` 当前报 **`lib/chem/phenomena.ts` 语法错误 16 条**（半成品，另一条轨道正在写，非本轨道；记录不动）。
- 改了哪些文件：`lib/safety/hazards.ts`、`lib/safety/hazards.test.ts`、`lib/safety/registry.ts`、`lib/safety/registry.test.ts`、`lib/safety/incidents/types.ts`、`lib/safety/incidents/exp09.ts`、`lib/safety/incidents/exp09.test.ts`、`.team/tasks/hazard-engine.md`、`.team/notes/hazard-engine.md`、`.team/handoff/hazard-engine.md`
- 需要 Lead 拍板的 3 件事：
  1. **refs 口径偏差（一处）**：规格 §7 给 exp09-H1 的 refs 是「S003、S006」，但 §5 里 S006 是「滴定管读数」，与酸雾无关。我按 §5 口径改成 `["S003","S010"]`（S010=通风橱内操作挥发性/刺激性试剂），代码里留了注释。要按原文回退只需改一行。
  2. **规范编号跨实验冲突**：exp03/exp05/exp06/exp08/exp10 的 md 各自自拟过 S001~S040（例如 exp08 把「天平」写成 S003、exp03 把「通风橱」写成 S005），与本库不一致。本库为准，回填 definition 的 refs 时由 Lead 统一改 md 的「待核清单」第 9 条。
  3. **类型归属**：`lib/engine.ts` 落地后，`Action/ExperimentState/CompetencyCode` 两边只能留一份。建议 engine 从 `lib/safety/incidents/types.ts` re-export，避免两份漂移；如反向改 import，我这边的结构是逐字照契约的，替换成本 ~10 分钟。
- 下一步 / 阻塞：
  - content 轨道做 exp09 definition 时必须按 `exp09.ts` 顶部注释填 `params`（或 choiceId 带语义 token，trigger 两种都认）。
  - 其余 9 个实验的事故表需要同一套模板（`incidents/<expId>.ts` + registry 挂一行 + 复用 hazards 库编号）——给我 exp01~exp08/exp10 的内容规格就能批量翻。
  - 文案抽 `strings.ts` 是 Lead 的活；`Incident` 里的 `title/why/consequence/correct/refs` 已经都是纯字符串，抽取不用改结构。
  - 引擎接线等我给的两个函数：`detectFirstIncident` 用于「一次只播一个动画」，`detectIncidents` 用于教师端事故分布统计。

## 2026-10-20 18:50 · 修复：编码损坏 + 与 engine/definition 对齐
- 修了什么（编码事故）：我用 PowerShell `Set-Content` 重排行数，Windows 默认编码把中文写成非法 UTF-8 → `tsc` 报 `TS1490 File appears to be binary`、行内字符串全断。**两个文件已删掉用 `write` 工具整文件重写**（`hazards.ts`、`incidents/exp09.ts`），未再碰 shell 重定向。以后写中文只走 `write`/`edit`。
- 证据：
  - `node scripts/check-encoding.mjs` → **编码检查通过：无 BOM / 无 NUL / 无非法 UTF-8**
  - `npx tsc --noEmit` → `lib/safety/**` **零错误**；全仓仅剩 1 条别人的错：`app/exp/[id]/workbench.tsx(78,16)`（UI 轨道 SetStateAction<"0.04">）
  - `npx vitest run lib/safety` → **3 files / 88 tests passed**（新增 15 条：definition 真实 choiceId 正向命中 + 正确动作零误命中）
  - `npx eslint lib/safety --max-warnings=0` → exit 0
- 与已交付物对齐（Lead 要求）：
  - `lib/safety/incidents/types.ts` 改为**只 re-export** `lib/engine.types.ts` 的权威类型（`Action/ExperimentState/Incident/FxKey/IncidentLevel/…`），不再自己声明一份，避免双源漂移；事故层扩展收在 `HazardIncident extends Incident { stepNo?; fxSilent? }`（两个可选字段，引擎不消费）。
  - `incidents/exp09.ts` 的 id/level/fx/deduct 逐条对齐 `experiments/exp09/definition.ts` 的 `ruleId`+`hazard(...)`：H1 L4/20、H2 L3/10、H3 L3/9、H4 L3/8、H5~H10 L2/5、H11~H14 L1/3；**H13 competency 由 S2 改为 K2**（与 definition 一致）。
  - trigger 的 choiceId token 补上 definition 的真实命名：`hold-burette`(H4)、`skip-rinse`(H7)、`excess-indicator`(H11)、`line-flow`(H12)、`single-trial`(H13)；已加单测锁死「definition 的 14 个 trap choiceId 全部命中对应事故」+「22 个正确 choiceId 零误命中」。
  - 引擎入账路径已写进 `registry.ts` 头注释：`detectFirstIncident(...)` → 组 `IncidentInput` → `applyIncident(state, input)`，幂等键 `(stepIndex, incidentId)` 由 engine 保证。
- 仍需 Lead 处理（不在我的写作用域）：
  - `experiments/exp09/definition.ts:342` 的 H1 feedback refs 写的是 `["S003","S006"]`，S006 在 hazards 库是「滴定管读数」，应为 `["S003","S010"]`（通风橱条目）；我这边 `exp09-H1.refs` 已按 S010 写，definition 未对齐会文案/规范卡不一致。

## 2026-10-20 19:20 · 新增：拼接式方案设计纯逻辑层 `lib/plan/**`
- 做了什么（新模块，未动 `lib/safety/**`）：
  - `lib/plan/pieces.ts`（253 行）：**32 块**素材 —— 器材 9（分析天平/酸式管/碱式管/移液管/容量瓶/锥形瓶/量筒/称量瓶/干燥器）、试剂 8（无水 Na₂CO₃/KHP/浓盐酸/NaOH 饱和液/酚酞/甲基橙/甲基红-溴甲酚绿/新沸冷却水）、步骤 10、参数 5（浓度/称样量/终点判据/平行次数/干燥制度）。每块 `{id,kind,title,sub,tags,demoId}`，`demoId = demo-design-piece-<slug>`；另导出 `PIECES_BY_ID/getPiece/piecesByKind/hasPiece` 和一份**满 100 分的 `REFERENCE_PLAN`**（演示与单测基线）。
  - `lib/plan/rules.ts`（278 行）：**21 条规则**（规格点名 18 条 + 补充 3 条：标定必须煮沸驱 CO₂、应做空白试验、酸碱必须配对应滴定管）。`{code,label,level,check,hint}`；`validate(plan) → {issues,passed,byRule,score,feasible,blockCount,warnCount}`；block −12 / warn −5 / 满分 100 / 最低 0，`feasible = 无 block`；另给 `toApiResult()`（直接满足契约 §9 `/api/design/validate` 的 `{ok,score,issues[{ruleId,level,text}]}`）与 `unknownPieces()`。
  - `lib/plan/assess.ts`（166 行）：`buildPrompt()`（把块、参数、21 条判定摊给模型，要求【结论】【依据】【下一步】三段）、`offlineAssessment()`（全过/有 warn/有 block 三档模板，都含三段且指向具体规则）、`assess()`（`DEEPSEEK_API_KEY` 或 `COZE_LLM_URL` → OpenAI 兼容接口，`LLM_TIMEOUT_MS=8000`，超时/非 2xx/空 content/网络异常 **一律回退离线，绝不 throw**）。可选 env：`DEEPSEEK_BASE_URL`/`DEEPSEEK_MODEL`/`COZE_LLM_TOKEN`/`COZE_LLM_MODEL`（默认值可跑）。
  - 单测 3 个：`pieces.test.ts`(84)、`rules.test.ts`(237)、`assess.test.ts`(163)。
- 证据：
  - `npx vitest run lib/plan` → **3 files / 99 tests passed**（18+3 条规则每条「通过」+「单独违反且不误伤其它规则」各一；评分边界 100/88/90/0；离线三档文案；无 key <100ms；断连/500/空 content 三路回退）
  - `npx tsc --noEmit` → **全仓 exit 0**（`lib/plan/**` 零错）
  - `npx eslint lib/plan` → exit 0；`node scripts/check-encoding.mjs` → 通过
  - 单文件行数全部 ≤300（最大 `rules.ts` 278）
- 页面/路由对接（给 UI 轨道）：
  - 校验：`POST /api/design/validate` 入参 `{pieces: string[], params?: Record<string,string|number|boolean>}` → `toApiResult(validate(plan))`；未知块用 `unknownPieces()` 报 400。
  - 点评：`POST /api/design/assess` 入参同上（或 `{planId}` 由服务端取回方案）→ `await assess(plan)`，返回 `{text, offline}`，**永不抛错**。
  - UI 直接可用：`byRule`（21 盏灯）、`issues[].hint`（违规项下方修复提示）、`REFERENCE_PLAN`（"载入示例方案"按钮）。
- 待核：规则文案里的数值（270~300 ℃/1 h、≤0.3% 相对平均偏差、≤0.2% 极差、20~35 mL 消耗体积）沿用 `docs/实验库/exp10.md` 的「待老师核」口径，老师改口径只改 `rules.ts` 的 label/hint 与阈值。


