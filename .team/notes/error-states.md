# error-states notes（错误 / 事故反馈）

## 2026-10-21 17:20 · 完成：lib/scene/fx.ts 只加可选字段（不破坏既有断言）
- 做了什么：`FxMeta` 增加可选 `aftermath?: "ember" | "smoke" | "spark"`，8 条事故各标注余波形态；新增 `getFxAftermath(key)`（缺省 smoke）。不加新 key、不改 duration/loop/semantic，`fx-keys.test.ts` 零改动。
- 证据：`npx vitest run lib/scene` → 5 files / 43 tests passed（含 fx-keys 5 条既有断言）。
- 改了哪些文件：`lib/scene/fx.ts`。
- 下一步 / 阻塞：无。

## 2026-10-21 17:32 · 完成：E1/E3 组件（拒收 + 系统错误）
- 做了什么：新建 `components/exp/incident/`：`RejectHint`（E1，trigger 180ms 淡入、目标红色虚线框一次 + 给目标加 `.ix-shake`、错在哪/为什么/怎么改三行、anchorRef/point 跟随定位、Esc/自动收）、`ErrorToast`（E3，顶部下滑 240ms、默认 3.5s 自动收、role=alert/aria-live=assertive、同时最多 1 条、action 按钮与关闭按钮均 44px、悬停/聚焦暂停计时）、`messages.ts`（`errorMessage()` 把异常分类成 network/server/timeout/auth/unknown 并只输出人话；`sanitizeForStudents()` 拦 ERR_/TypeError/Failed to fetch/堆栈，但不误伤 500 mL、pH 7.00）、`use-is-client.ts`（useSyncExternalStore 水合判定，避开 set-state-in-effect 规则）。
- 证据：`npx eslint components/exp/incident` → 0 error/0 warning；`npx vitest run components/exp/incident` → 7 tests passed（含错误码不泄漏、化学数字不误伤两条反向断言）。
- 改了哪些文件：`components/exp/incident/{RejectHint.tsx,ErrorToast.tsx,messages.ts,messages.test.ts,use-is-client.ts,index.ts,incident.module.css}`。
- 下一步 / 阻塞：`index.ts` 已导出全部组件与 messages 工具，待 Lead 接线。

## 2026-10-21 17:34 · 完成：E2 事故条 + 重做条 + fx 局部震动/余波
- 做了什么：`IncidentBanner`（E2，事故名 + 三行，absolute 窄条 top/bottom，不遮台面中央，文案走 sanitize）、`RetryBar`（≥44px 主/次按钮 + focus-visible + 入场 260ms）；`fx/index.tsx` 把原 body 整页震动改为「只抖实验台/场景层」：先 closest `[data-scene]`/演示舞台，命中舞台内 `[data-bench]`（实验台）时只抖台面器皿，否则退化为抖特效外壳；新增 `fx-impact.module.css`（L1~L4 复用 --fx-shake-*、600ms 起播的 1.2s 余波余烬/烟尾共 6 个节点、reduced-motion 全静止且余波停终态一帧）。原 fx.module.css 中 body.fx-impact-* 死代码与对应 reduced-motion 规则已移除。
- 证据：`npx tsc --noEmit`（Filter 掉其他角色正在写文件的瞬时错误后）我的文件 0 错；`npm run lint` → 0 error；`npx vitest run` → 29 files / 458 tests passed（新增 incident 7 条）。
- 改了哪些文件：`components/exp/incident/{IncidentBanner.tsx,RetryBar.tsx,incident-followup.module.css}`、`components/exp/scene/fx/{index.tsx,fx-impact.module.css,fx.module.css}`。
- 下一步 / 阻塞：接线（Lead）：`<FxByKey>` 签名未变；`IncidentBanner` 挂到 stage 内（absolute）；`RejectHint`/`ErrorToast` 自带 portal 只需控制 open。

## 2026-10-21 17:37 · 完成：最终验收复跑（我的作用域）
- 做了什么：复跑全项目命令，确认无回归；补齐 `RejectHint` 对目标元素加 `.ix-shake`（240ms，reduced-motion 由 motion.css 静音）与 Esc/自动收；fx 余波延迟改 600ms（CSS 变量），震动目标优先舞台内 `[data-bench]`。
- 证据：`npx tsc --noEmit` = CLEAN；`npx vitest run` = 29 files / 458 tests passed；`npx eslint components/exp/incident components/exp/scene/fx lib/scene/fx.ts` = 0/0；`npm run lint` 全项目 2 error 均在 `app/exp/[id]/workbench.tsx`（非我作用域，已同步 Lead）。
- 改了哪些文件：`components/exp/incident/{RejectHint.tsx,incident.module.css,incident-followup.module.css,IncidentBanner.tsx,RetryBar.tsx,messages.ts,messages.test.ts,index.ts,use-is-client.ts}`、`components/exp/scene/fx/{index.tsx,fx-impact.module.css,fx.module.css}`、`lib/scene/fx.ts`、`.team/handoff/error-states.md`。
- 下一步 / 阻塞：等待 Lead 接线 E1/E2/E3 到 workbench；lint 的 2 个 error 由接线 owner 修。
