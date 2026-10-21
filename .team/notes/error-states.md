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

## 2026-10-22 04:05 · 进行中：L1~L4 四级视觉 + 临时验收页
- 做了什么：`IncidentBanner` 重写为四级：L1 细边+琥珀左 3px、1.6s 自动收；L2 图标+`−N 分` rAF 数字跳动、2.4s；L3 `--bench-ink-dark` 局部暗场 + 280ms 轻震；L4 全屏压暗（z=8，低于 rail 10/任务看板 12/Dock 27/顶栏 30）+ 红框收束 + 「本次实验终止」+「重做本步 / 查看原因」两动作（≥44px）。`onExplain` 缺省会展开并滚动到 `demo-feedback-detail`（找不到 no-op）。fx 层 L3 改为只暗场景块（`stageDim`），L4 压暗改由 banner 负责（无 fx 的 L4 也有压暗）；新增 `use-count-up.ts`；CSS 拆为 `incident-banner.module.css` / `incident-retry.module.css`；新增临时路由 `app/dev/incident-preview`（devtoolsEnabled 守卫，截完删除）。
- 证据：Playwright 四级截图已落 `%TEMP%\chemlab-shots\incident-L{1..4}-*.png`；断言：任务看板/右栏与事故条 0 重叠；L3 stageDim opacity=0.18；L4 dim opacity=0.34、红框 2px、两按钮高度 44px 且 elementFromPoint 命中按钮；pageerror 0。
- 改了哪些文件：`components/exp/incident/{IncidentBanner.tsx,incident-banner.module.css,incident-retry.module.css,use-count-up.ts,index.ts,IncidentPreview.tsx,incident-preview.module.css}`、`components/exp/scene/fx/{index.tsx,fx-impact.module.css}`、临时 `app/dev/incident-preview/page.tsx`。
- 下一步 / 阻塞：dev 3002 因 `app/exp/[id]/workbench.tsx` L56-60 `REJECT_FALLBACK` 乱码/引号丢失整站 500（非我作用域，已通知 Lead + workbench-ux）；修好后重截干净四图、删除临时路由；Lead 接线需补 `level` / `deduction`，并把 L1/L2（含 violation 事件）也纳入 banner。

## 2026-10-22 04:16 · 完成：L1~L4 四级视觉 + 四级截图 + 临时路由清理
- 做了什么：`IncidentBanner` 四级落地（L1 细边/琥珀 3px + 1.6s；L2 图标 + rAF 扣分跳动 + 2.4s；L3 暗场 + 280ms 轻震；L4 全屏压暗 z=8 + 红框 + 主文案 + 两动作，全部 ≥44px）。L4 压暗/红框从 fx 层移到 banner（无 fx 的 L4 也有终止视觉）；fx L3 改为 `stageDim` 只暗场景块；CSS 拆成 `incident-banner` / `incident-terminate` / `incident-retry` 三个 ≤300 行模块。临时 `app/dev/incident-preview` 截图后已删除（含 IncidentPreview + preview css），`npx next typegen` 清掉生成类型。
- 证据：`%TEMP%\chemlab-shots\incident-L1-reminder-exp09-step5.png`、`incident-L2-deduction-exp01-step1.png`、`incident-L3-serious-exp09-step1.png`、`incident-L4-terminate-exp01-step7.png`；Playwright 断言：看板/右栏 0 重叠、L3 stageDim .18、L4 dim .34/红框 2px/两按钮 44px+可点、pageerror 0；`tsc` CLEAN、`npm run lint` 0 error、`vitest` 36 files/519 passed。
- 改了哪些文件：`components/exp/incident/{IncidentBanner.tsx,incident-banner.module.css,incident-terminate.module.css,incident-retry.module.css,use-count-up.ts,index.ts}`、`components/exp/scene/fx/{index.tsx,fx-impact.module.css}`。
- 下一步 / 阻塞：workbench 接线还差 `ui.event?.level` 条件 + `level`/`deduction`/`onRetry` 三个 props（已发 Lead 精确 diff）；修完 L1/L2 才会出条，L4 才有两动作。

## 2026-10-22 04:45 · 完成：真实链路 L1~L4 截图（:3001 prod）+ L1/L2 收成细条
- 做了什么：在 prod build 上按真实操作触发四级（登录→实验页第1步→点陷阱），验证 workbench 接线后的真实效果；发现 L1/L2 与结果条/右栏三重复读，把 L1/L2 从三行收成「单行怎么改」细条（L3/L4 仍三行），更贴合用户「细边条」口径。为截到新样式：停 3001 → `npm run build`（04:42）→ `scripts\restart-prod.ps1`（DEVTOOLS=1 保留，/dev=200）。
- 证据：`incident-real-L1-exp01-step1-wipe.png`、`incident-real-L2-exp01-step1-oven.png`、`incident-real-L3-exp09-step1-bare-hands.png`、`incident-real-L4-exp03-step1-open-acid.png`（均在 `%TEMP%\chemlab-shots`）；每级都实测 `data-level` 与期望一致；看板/右栏/结果条 0 重叠；L4 dim .34/红框 2px/z=8、三按钮（含关闭）44px 且 elementFromPoint 命中；pageerror 0。
- 改了哪些文件：`components/exp/incident/{IncidentBanner.tsx,incident-banner.module.css}`；构建产物 `.next` 更新并重启 3001。
- 下一步 / 阻塞：无。若 workbench-ux 仍觉得和结果条重复，可只对 L1/L2 隐藏 ResultBar 的失败文案（他们的文件），banner 建议保留——四级视觉需要它。
