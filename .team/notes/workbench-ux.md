# notes · workbench-ux（操作台体验 / 拖拽三段式 + 轻度 UI 收敛）

## 2026-10-21 17:30 · 完成：drop 判定纯函数 + 单测（拖拽三段式的"算不算"）
- 做了什么：新增 `components/exp/guide/drop-resolve.ts`（纯函数，0 依赖）：
  - `resolveDrop(step, reagentId, performed)` → `accept(choiceId)` / `reject(line)`；
    规则只用定义里既有数据：choice.type ∈ {addDrops,dissolve,dilute,transfer,titrate} + 文案/params.indicator 指向该试剂；
    正确动作前置未满足 → 拒收并点名缺的前置；只有陷阱动作 → 拒收并复述事故标题；本步不加试剂 → 拒收并提示该做的动作。
  - `REAGENT_DROP_COPY`（原 scene-stage 的 DROP_COPY 搬过来，一处文案）、`SNAP_MS=160 / POUR_MS=700 / REJECT_MS=240`。
- 证据：`npx vitest run components/exp/guide/drop-resolve.test.ts` → 7 passed；`npx tsc --noEmit` → 0。
- 改了哪些文件：`components/exp/guide/drop-resolve.ts`（新）、`components/exp/guide/drop-resolve.test.ts`（新）。
- 下一步：`use-drop-flow.ts` 钩子（吸附→倒入→推进 / 回弹→拒收→原地重试），scene-stage 接上。

## 2026-10-21 · 口径调整（Lead 转达用户 17:2x）
- 流程正确性 > UI 美化：UI 只做轻度收敛（合并多条提示为 1 条、去掉坐标角标等装饰、详情类折叠），
  **不重排主结构、不删参数卡/事件条**，demo 钩子与 stepIndex/dispatch 语义不动（唯一例外：drop 的 dispatch 延后到倒入动画结束）。
- 每完成一小块立刻跑 tsc + vitest 并记进本文件；handoff 里把 diff 分成「流程有影响的改动」「纯视觉改动」两类。

## 2026-10-22 03:00 · 完成：提示三级阶梯（A）+ 拖拽三段式收口（B）
- A 三级阶梯（唯一口径 `components/exp/guide/hint-ladder.ts`）：
  - L1→h0（方向）/ L2→h1（具体）/ L3→h2（高亮），每步最多 3 次，第 4 次不再给；
  - 扣分 1 / 3 / 5（`HINT_DEDUCT`），`use-workbench.ts` 的 `revealHint` 按 `hintUsedInStep` 递增档次；
  - 入口统一到 `workbench.tsx` 的 `askHint()`（灯泡 / 键盘 H / 24s 空闲 / 看板折叠区），用完时按钮 `disabled` + “本步提示已用完”；
  - L3 高亮：能倒试剂 → 锥形瓶热区描边+箭头（`data-hint-highlight`）；否则 → 主按钮描边+箭头（`NextActionCard highlight`）；
  - 同屏仍只留 1 条：提示文本占用看板第 4 行（`missionGuide(ui.hint?.text, ...)`），不再另开面板。
- B 拖拽三段式：抓起 `opacity .92 + scale(.98)`、热区 `outline + 淡填充`、松手吸附 160ms → 倒入 700ms 播完才 dispatch、
  失败回弹 240ms + 拒收三行（`RejectHint`）+ `fail-reject` 音效，原地可重试（不重置本步）。
- 证据（损坏前）：
  - `npx vitest run` → 35 files / **513 passed**（含 `hint-ladder.test.ts` 3 + `drop-resolve.test.ts` 7）；
  - `npx tsc --noEmit` → 0；`npm run lint` → **0 error**（12 条既有 warning）；
  - 截图：`%TEMP%\chemlab-shots\20261022-hint\hint-l1.png / hint-l2.png / hint-l3.png / hint-exhausted.png / hint-board-open.png`
    （1440×900，2002 端口 dev；L1 `H1 1/3`、L2 `H2 2/3`、L3 `H3` + 按钮高亮、第 4 次 `已用完` 置灰）。
- 改了哪些文件：`components/exp/guide/hint-ladder.ts`（新）、`hint-ladder.test.ts`（新）、`use-workbench.ts`、
  `workbench.tsx`、`scene-stage.tsx`、`NextActionCard.tsx`、`mission-board.tsx`、`mission-board-details.tsx`、
  `mission-board.module.css`、`guide.module.css`、`workbench.module.css`。

## 2026-10-22 04:0x · 事故：workbench.tsx 双重编码（已定位，Lead 负责恢复）
- 根因：我用 PowerShell `Get-Content -Raw`（按 GBK 解码）→ `WriteAllText(UTF8)` 回写，UTF-8 被当 GBK 再存成 UTF-8；
  中文串尾字符/右引号被吞，Turbopack 报 `Unterminated string constant`，dev:3002 与 prod:3001 都停了。
- 现状：**Lead 在修**（逐行 GBK→严格 UTF-8 可逆判定 + 少量手工补）；我被告知**不要写 workbench.tsx**。
- 我今日改动全部已落盘（损坏前），无待贴内容；清单见 handoff。其他我动过的文件已逐个自查：均为合法 UTF-8 无乱码。
- 教训：此仓库中文文件只能走 `write`/`edit` 工具或 node `fs.writeFileSync(p, s, "utf8")`；**禁止** PowerShell 写文件。

## 结算侧（Lead）需要配合的精确字段 / 公式 —— 提示三级阶梯
- 唯一口径：`components/exp/guide/hint-ladder.ts`
  - `MAX_HINTS_PER_STEP = 3`；`HINT_DEDUCT = { 1: 1, 2: 3, 3: 5 }`；
  - `hintTierFor(used)`：used 0/1/2 → 1/2/3，used ≥3 → null（不再给）；
  - `hintIndexFor(level)`：L1→h0、L2→h1、L3→h2（definition 里已有文案，不新增文案）。
- workbench 侧产出（结构未变，语义变了）：
  - `ui.hintUsages: { competency: CompetencyCode; stepIndex: number; level: 1 | 2 | 3 }[]`
    —— **一次取提示 = 一条**（不再按 level 去重）；第 4 次不追加；`retry`（重做本步）会清掉本步记录。
  - `ui.hint = { level, text, shouldDeduct, deduct, used, exhausted }`，`deduct` 就是本次扣分（1/3/5）。
- 需要结算侧改三处（我这边只做 UI 与本地显示）：
  1. `lib/pedagogy/scoring.ts#computeIndependentDeduct`：改成 `Σ HINT_DEDUCT[hint.level]`（现在仍是 `level>=2 每条 ×1`）。
  2. `lib/persist/score.ts` / 报告页：本步提示次数 = `hints.filter(h => h.stepIndex === stepIndex).length`；
     本步提示扣分 = `Σ HINT_DEDUCT[h.level]`；展示成「第 N 步 · 提示 k 次 · −X 分」；教师端汇总提示总次数 / 总扣分。
  3. 数据来源：replay 现在只能收到“动作引发的 hint 事件”，收不到学生主动点灯泡。
     建议 `POST /api/runs/[id]/events` 兼容 `{ hint: { stepIndex, level, deduct, competency } }`
     （appendRunEvents 里落一条 hint 记录，不改 state / 不推进 stepIndex）。
     workbench 已留唯一入口 `askHint()`，并写了 `TODO(结算侧 · Lead)` 注释标出调用点；接上后即可上报。
- 兼容性：`HintUsage` 类型不变（仍 3 个字段）；只是 level 取值从 0..4 收敛为 1..3。
- 操作台本地分数已按 1/3/5 重算（`use-workbench.ts#operationScore` 覆盖 `independentDeduct`），
  与上面结算口径一致；报告页/教师端在结算侧改完之前仍会偏低。

## 2026-10-22 04:20 · 编码事故已解除 + 7 块核对完成
- Lead 分四步还原 workbench.tsx（严格/宽松 GBK 往返 + 骨架匹配 + 手工补 18 行），`npx tsc --noEmit` 恢复 0。
- 我接手后补了 **5 处仍带 U+FFFD 的用户可见文案**：`演示模式 · 不记录`、`退出`、`允许误差：…（template）`、
  `交卷并查看报告`、L2 扣分行 `−${deduction} 分`；剩 29 处 U+FFFD **全在注释**（丢的是 `→`/`、` 等标点），
  不影响编译与运行，作为已知债务记在 handoff（要清可用 18:01 map + HEAD 骨架匹配脚本，见 `.team/fix-workbench*.mjs` 思路）。
- 7 块逐块核对结果（全部在位）：
  1) hint 三级阶梯：imports L24-29、`hintUsedInStep` L50、派生 L600-607、看板 props L1049-1058、灯泡 L1322-1347（禁用+data-exhausted+已用完）；
  2) L3 高亮：`hintHighlight={hintOnFlask}` L1082、`highlight={hintOnAction}` L1198，CSS 在 guide.module.css L709-740；
  3) IncidentBanner：L1098-1112，已按 error-states 新口径改成 `ui.event?.level`（L1~L4 都出）+ `level/deduction/onRetry`；
  4) ErrorToast 重试：`retryRef` L186/216，action L1367-1378，`demo-error-retry`；
  5) askHint 唯一入口 L700-703，四个入口 L824/L862/L1057(onAsk)/L1325；
  6) `finishUrl` L755 带 `?auto=1`；
  7) 确定性节奏 L905-908（无 Math.random）。
- 证据：`npx tsc --noEmit` 0 输出；`npm run lint` **0 error / 15 warning**（warning 全在 scripts/*.mjs）；
  `npx vitest run hint-ladder.test.ts drop-resolve.test.ts` → **14 passed**（hint 3 + drop 11）。
- 顺手发现：`workbench.module.css` 里有一套**旧的 hintBox/hintHead/hintMeter 样式**（L1002-1058）已无 JSX 引用（死 CSS），
  其中 `.hintButton` 会覆盖页脚灯泡的 `padding`（min-width 76 / height 32 仍在，尺寸 OK）；清理留到演示后，避免现在动样式。
- 待办：:3001 起来后重截 hint 三级 + drag 三段式（脚本 `.team/hint-shot.mjs`、`.team/drop-check.mjs`，都读 `BASE_URL`）。

## 2026-10-22 04:35 · :3001 实测（hint ✅ / 拖拽 ❌ 抓到 CSS Modules 坑）
- hint 三级阶梯实测通过（1440×900，:3001 prod）：
  - L1 `data-level=1` 文案「这一步出了安全问题…」、L2 `data-level=2`「称碱为什么要戴手套？」、L3 `data-level=3` 且 `data-exhausted=true disabled`（三次用完即锁）；
  - 看板第 4 行同步显示提示文本，截图 `%TEMP%\chemlab-shots\20261022-hint\{hint-l1,hint-l2,hint-l3,hint-exhausted,hint-board-open}.png`；
  - 唯一不一致：L3 文案写「高亮手套与聚乙烯瓶图标」，实际高亮的是右侧主按钮（`hintOnFlask` 只在能倒试剂时亮锥形瓶）。
    文案在实验定义 `hints.h2`（别人 owner），**不改文案**；后续要么按关键词高亮器具，要么把 L3 文案改成「照右侧主按钮做」。低风险，已记 handoff。
- 拖拽实测（`:3001` 04:13 构建，`.team/drop-check.mjs`）：
  - ✅ 跟手热区：`flask[data-over=true]`、舞台虚线框 + 「松手加入」、试剂 `opacity .92`；
  - ✅ 失败回弹：松手 → 试剂回原位（`translate` 过渡 240ms）→ 三行拒收「错在哪/为什么/怎么改」+ `demo-reject-hint`，本步不动；
  - ❌ 抓起 `scale` 仍是 **1.03**（要求 .98）。
- **根因（重要，可复用）**：`workbench.module.css` 里 `.reagent.ix[data-dragging="true"]` 的 `.ix` 被 CSS Modules 当本地类哈希成
  `SPhgxG_ix`，而 DOM 上是全局 `ix` → 选择器永不匹配，实际生效的是 motion.css 的 `.ix[data-dragging=true]{scale(1.03)}`。
  已经全仓扫过：只有 `workbench.module.css` 踩了这个坑；**修法 = `:global(.ix)`**（已改 5 处：
  `.reagent:global(.ix)[data-dragging="true"]`、`.flaskTarget:global(.ix):hover/:active` ×2 组）。
  验证方法：build 后浏览器里 `getComputedStyle` 拖拽中试剂应为 `matrix(0.98…)`；CSS 包里选择器应是 `.SPhgxG_reagent.ix[data-dragging=true]`（`.ix` 不再带哈希）。
- 状态：修复已落源码，**等下一次 `npm run build`** 才进 CSS 包；已请 demo-flow 下一轮带上。
- 另：`/exp/exp01` 打开时有 3 个 401（未登录跑实验，`/api/runs/*` 类接口）——页面功能不受影响，登录后应消失；待 demo-flow 重启后我确认 URL。

## 2026-10-22 04:45 · 收口：CSS 坑已修 + 三段式全链路实测通过 + 四绿
- CSS 修复生效（build 04:23:11，chunk `34zt2dq4r6l-v.css`）：选择器已是 `.SPhgxG_reagent.ix[data-dragging=true]{…transform:scale(.98)}`。
  实测 `mid-drag`：`opacity 0.92` + `matrix(0.98,…)` ✅（此前是 1.03）。
- 拖拽三段式全链路实测（:3001，`.team/drop-check.mjs` + `.team/accept-check.mjs`）：
  1) 抓起：`opacity .92 + scale(.98)`，`data-dragging=true`；
  2) 跟手热区：`flask[data-over=true]` + 舞台虚线框 + 「松手加入」；
  3) 成功（exp01 第 4 步 溶解，拖蒸馏水）：`[data-pour-key]` 覆盖层 0~550ms 在，**600ms 时**才 `现在该溶解了 → 现在该观察了`
     ——即倒入动画播完后才 dispatch；成功音效 + SuccessBurst；
  4) 失败（exp01 第 1 步 拖碳酸钠）：回原位（`translate` 240ms）+ `demo-reject-hint` 三行「错在哪/为什么/怎么改」，本步不动、可原地重试。
- 401 已定位：`/api/session` + `/api/runs`（探针浏览器没登录）。**不是 bug**；用户从 /login 进就有 cookie。
- 最终四绿（04:33）：`npx tsc --noEmit` 0；`npm run lint` **0 error / 15 warning**；`npx vitest run` **36 files / 519 passed**；
  浏览器 `:3001` exp01/exp09 全流程无 pageerror（除上面两个预期 401）。
- 已清理临时恢复脚本；保留 `.team/hint-shot.mjs` / `drop-check.mjs` / `accept-check.mjs`（都读 `BASE_URL`，可复用）。

## 2026-10-22 04:50 · 移动端 + 收尾
- 390×844（`isMobile/hasTouch`，`.team/mobile-check.mjs`）：`scrollWidth 390 = clientWidth 390`（无横向溢出），
  灯泡 **86×44**（≥44 可触），连点两次 → `data-level=2`、`H2 2/3`，pageerror 0；截图 `%TEMP%\chemlab-shots\20261022-mobile\hint-mobile-l2.png`。
  已知小问题（非我 scope）：DEV Dock（左下）在窄屏压住 keyFooter 文案一行；`?force=1` 才出现，演示前可留意。
- 401 处理：demo-flow 建议 `demoReadonly` 时跳过 session fetch。**没做**——workbench.tsx 当时正被 Lead 并发修改
  （我 `edit` 被 FS 版本守卫拒绝，随后文件 mtime 回退到 04:13 的版本，说明有人用备份覆盖），现在改会互相覆盖；
  且 demo-flow 确认那 4 条 401 是预期（匿名 `/api/session`），不影响演示。要清零时加两行即可（`bootstrap` 里 demoReadonly 提前 return）。
- 并发提醒：`use-workbench.ts` 04:37、`lib/pedagogy/hints.ts` 04:34 被别人改过（加了 `HintLevel`/`hintDeductForLevel`，结算侧在接），
  我跑全量测试时撞到一次瞬时失败（`lib/persist/events.test.ts` 1 failed），**单独重跑 3/3 通过**，属并发写文件的假失败。
- 最终证据：`tsc 0`；`lint 0 error / 15 warning`；`vitest 519 passed`（36 files，04:32 稳定跑）；:3001 实测 hint 三级 / 三段式 / 移动端全过。
- 空闲自动提示实测（`.team/idle-check.mjs`，exp09）：t=0 与 t=15s 看板第 4 行仍是本步指引、`data-level=0`；
  **t=27s（阈值 24s）**自动浮出 L1「这一步出了安全问题…」，灯泡变 `H1 1/3` → 20~30s 无操作自动 L1 达标。

## 2026-10-22 04:55 · 清过期 TODO + demo 401 复测（构建没更新）
- Lead 批准清理 `askHint` 上方那段过期 TODO（原 L689-700）。已用 node fs 按行替换成 6 行干净注释：
  唯一入口（灯泡/H/24s）、上报 `{kind:"hint"}`、服务端落审计行→replay→`HINT_DEDUCT_BY_LEVEL` 求和、`?play=demo` 不落库。
  **只动注释，`askHint` 逻辑零改动**；文件 U+FFFD 行数 29 → **23**（剩余全在注释）。`npx tsc --noEmit` 0、`npm run lint` 0 error / 15 warning。
- `?play=demo` 401 复测（`.team/demo-401-check.mjs`）：readonly badge 正常（「演示模式 · 不记录」），仍是 **1 条 `401 /api/session`**，`/api/runs` 已不发。
  查证构建时间：`.next/BUILD_ID` **04:42:40**、`standalone/server.js` **04:42:43**、CSS chunk **04:42:35**、node pid 1668 启动 **04:43:08**
  → **:3001 仍是 04:42 旧构建，Lead 说的新 build 没落到这台机器的 `.next`**。已请 Lead 重新 `npm run build` + `restart-prod.ps1`；
  起来后用同一脚本复测，验收口径 = Network 里没有 `/api/session`。

## 2026-10-22 04:58 · 401 清零确认（收工）
- Lead 重建（`BUILD_ID` **04:55:55**，含我 04:54:32 的注释清理）后复测：
  - `?force=1&play=demo`：`demo state {"readonly":true,"badgeText":"演示模式 · 不记录"}`、**`4xx: none`** ✅
  - 根因修法（比客户端跳过请求更正确）：`GET /api/session` 匿名从 `401` 改 `200 {ok:false}`；Dev Dock 判断从 `res.ok` 改 `body.ok`，
    避免把 200 误判成“已登录”。
  - 回归（同一 build）：hint L1 `H1 1/3` → L3 `H3`+`已用完`+disabled 正常；拖拽 `mid-drag` = `opacity .92 + matrix(0.98)`、`data-over=true`；pageerror 0。
  - 仅剩的 4xx：**匿名且非 demo** 打开实验时 `POST /api/runs` 401（未登录没有 run 可建，按设计；从 /login 进则无）。如需清零可照 session 改成 200+`ok:false`，属后端 owner。
- 结论：task-7 全部验收项通过，`.team/handoff/workbench-ux.md` 已是最新，收工。
