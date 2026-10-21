# engine-core notes（只追加）

## 2026-10-20 18:40 · 完成：状态机 + exp09 定义垂直切片，44 测试全绿
- 做了什么：
  - `lib/engine.types.ts`：契约 §1~§8 的 TS 投影（ActionType 17 原语 / CompetencyCode / Event 联合 / ExperimentState / Incident / HintLevel / TimelineRow），外加定义层类型（StepDefinition、ChoiceDefinition、ChoiceHazard、StepJudge、StepHints、IncidentInput）。
  - `lib/engine.ts`：`apply`（顺序保护 out-of-order / already-completed、重复提交与前置动作校验、陷阱产出 feedback+hint+violation/incident、完成推进、stateChanged diff）、`applyIncident`（规则层动态判定入账、幂等）、`initState/getStep/getDefinition/listExperimentIds`。`state.stepLog`（可选字段）做幂等簿记。事件顺序与"引擎不判对错"的边界写在文件头注释。
  - `experiments/exp09/definition.ts`：7 步全量定义（每步 3 正确 + 1~3 陷阱，14 陷阱 = L4×1/L3×3/L2×6/L1×4），`requires` 表达"先称量再定容"等硬顺序；步级 demo-id 与规格 §6 最后一列逐字一致。
  - `lib/engine.test.ts`（27 条）+ `experiments/exp09/definition.test.ts`（17 条）。
- 证据：
  - `npx vitest run lib/engine.test.ts` → 27 passed。
  - `experiments/exp09/definition.test.ts` 用临时配置（include 加 `experiments/**/*.test.ts`，已删除临时文件）→ 17 passed。
  - `npx eslint` 上述 5 文件 → 0 error 0 warning；`npx tsc --noEmit` → 我的文件 0 error，仅 `lib/chem/phenomena.ts`（别的轨道在写）报错。
- 改了哪些文件：`lib/engine.types.ts`、`lib/engine.ts`、`experiments/exp09/definition.ts`、`lib/engine.test.ts`、`experiments/exp09/definition.test.ts`、本 notes + `.team/tasks/engine-core.md`。
- 下一步 / 阻塞：
  - **阻塞 Lead**：`vitest.config.ts` 的 `test.include` 缺 `"experiments/**/*.test.ts"`，交付命令里的 `definition.test.ts` 目前不会被收集（只跑 27 条）。加一行即闭环。
  - 规则轨道：`lib/safety/incidents/exp09.ts` 的事故表与 `definition.ts` 里的 `ruleId/incidentId/fx/level/deduct` 保持一致；动态追加判定走 `applyIncident`，重复入账已幂等。
  - UI 轨道：`data-demo-id` 用定义里的 `step.demoId` / `choice.demoId`，别自己拼。

## 2026-10-21 11:25 · 完成：three.js 3D 试点（?scene=3d）+ 可行性数字
- 做了什么：
  - 装 `three@0.186.1`（dependencies）+ `@types/three@0.186.0`（devDependencies），无其它依赖；`package-lock.json` 随之更新。
  - 新增 `components/scene3d/vessel-mesh.tsx`（滴定管：圆柱+刻度线+活塞+尖嘴+液柱；锥形瓶：锥体+瓶颈+液面按高度重建几何）、`components/scene3d/titration-scene.tsx`（WebGLRenderer + 一盏主光/半球光、指针/方向键旋转、rAF、`document.hidden` 停、`prefers-reduced-motion` 不自动旋转不落液滴、WebGL 失败降级文案、卸载全 dispose）、`components/scene3d/scene3d.module.css`。
  - `app/exp/[id]/scene-stage.tsx` 只加：`useScene3d()` 读 `?scene=3d`、exp09+3D 分支、`data-scene`、caption 文案；asset-pipeline 轨道的 `pour`/`stageRef` 改动原样保留。默认仍 2D，2D 代码路径一行没改。
- 证据：
  - Playwright（Edge headless，1440×900，登录 20250101/周若曦）：`/exp/exp09?force=1&scene=3d` → `data-scene=3d`、canvas 848×674、webgl2=true、**console/pageerror 0 条**；2 秒 rAF 平均 **240 fps**（headless 无 vsync，481 帧/2.002s，≈4.2ms/帧）；拖拽旋转 `data-dragging` 置位/清除正常；`prefers-reduced-motion` 下 canvas 仍渲染。
  - 2D 回归：`/exp/exp09?force=1` → `data-scene=2d`、3D canvas 数 0。
  - 移动端 390×844@2x：canvas 370×385、**无横向溢出**、0 错误；竖屏相机自动拉远后滴定管完整入画。
  - 无 WebGL（`--disable-webgl --disable-3d-apis`）：显示降级文案 "3D 场景不可用（THREE.WebGLRenderer: Error creating WebGL context.）…"，canvas 0、页面无 Application error。
  - SSR：`?scene=3d` 的**服务端 HTML 不含 canvas / three / demo-scene-3d**（38 KB，`data-scene="2d"`），挂载后才加载 3D chunk，无 hydration 报错。
  - 体积（esbuild tree-shaken+minify 估算，因本轮禁 build）：3D 路径 **734.2 KB raw / 189.1 KB gzip / 154.2 KB brotli**；2D 默认路径 0 额外字节（动态 import 不触发）。`node_modules/three` 安装态 19.5 MB / 1263 文件。
  - `npx tsc --noEmit` 0；`npm run lint` 0 error（8 warning 均在别人文件）。
- 改了哪些文件：`components/scene3d/*`（3 个）、`app/exp/[id]/scene-stage.tsx`、`package.json`、`package-lock.json`、本 notes。
- 下一步 / 阻塞：
  - 3005 的 dev 是**隔离副本** `E:\workspace\public\NOBBBB\chem-lab-dev11`（hardlink node_modules，源码 robocopy 同步），因为 3004 已有别人的 dev server、Next 16 同目录拒绝第二个 dev；主仓没留临时脚本，`.pgdata-dev11` 在副本外（PGLITE_DIR 指主仓）。演示 URL：http://localhost:3005/exp/exp09?force=1&scene=3d
  - 推广前建议：真跑一次 `next build` 核对真实 chunk 体积；3D 器皿资产是主要成本（B 级 10~12 件，本次只做 2 件）；`?scene=3d` 首帧是 2D→3D 挂载切换（要更快需服务端传参，得改 workbench.tsx/page.tsx，不在本次写作用域）。
