# 事故与安全规范层（hazard-engine）

认领人：hazard-engine
独占文件：`lib/safety/hazards.ts`、`lib/safety/incidents/types.ts`、`lib/safety/incidents/exp09.ts`、
`lib/safety/registry.ts`、`lib/safety/*.test.ts`、`lib/safety/incidents/*.test.ts`

## 目标（≤5 条）
1. 规范条目库 S001…（含 exp09 §5 的 S001~S009），每条：编号/标题/要求/适用场景/来源口径+【待老师核】。
2. Incident 接口照契约 §5；exp09 的 14 条事故逐条翻译（why/consequence/correct/refs/deduct/competency 全写全）。
3. trigger 纯函数 `(state, action)`：只看 stepIndex + action.params/choiceId，不读全局、无随机。
4. 四级扣分不越界：L1 2~3 / L2 5 / L3 8~10 / L4 15~20 且 terminate=true。
5. registry 按 expId 汇总，提供 detectFirstIncident（级别高优先，确定性）。

## 对上游/下游的接口
- 从 engine 轨道**不需要**东西；`lib/engine.ts` 的类型未落地，types.ts 先镜像契约，engine 落地后二选一合并。
- 给 engine：`detectFirstIncident(expId, state, action)` 直接产出契约 §4 的 `incident` 事件字段。
- 给 content 轨道：definition 的 `params` 键名约定见 `exp09.ts` 顶部注释（order/bareHand/buretteType…）。
- 给 UI：`incident.fx` + `incident.fxSilent`（L1/L2 无动画）；文案取 title/why/consequence/correct/refs。

## 验收
- `npx vitest run lib/safety` → 3 files / 73 tests passed
- `npx tsc --noEmit`（只我这份文件域）→ exit 0；全仓 tsc 受 `lib/chem/phenomena.ts` 半成品影响（非本轨道）
