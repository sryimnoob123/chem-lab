# asset-pipeline notes（只追加）

## 2026-10-20 18:05 · 完成：三张官方品牌图落盘并逐张核验
- 做了什么：用 `Invoke-WebRequest` 从 henu.edu.cn / energy.henu.edu.cn 下载校徽、校名横版、学院横版到 `public/brand/`；用 Pillow 查尺寸/alpha/底色，逐张 `read_image` 看过内容，写了 `public/brand/README.md`（来源、尺寸、哈希、用法与合规）。
- 证据：`docs/design/brand-preview.png`；文件 218×214 / 260×73 / 736×71；三张都是真 PNG（magic `89504e47`）。
- 关键发现：`f3.png` 就是圆形标准校徽（白底非透明）；两张横版是**白字透明底**，浅底等于隐形，只能放深色底——已写进 README 和 ASSETS。
- 改了哪些文件：`public/brand/henan-university-emblem.png`、`henan-university-lockup.png`、`college-lockup.png`、`README.md`。
- 下一步 / 阻塞：无。UI 用横版时记得垫深色底；对外公开前须请示校方（README 已写）。

## 2026-10-20 18:22 · 完成：字体 woff2 落盘 + 浏览器加载自检
- 做了什么：从 jsDelivr 取 `@fontsource/noto-sans-sc@5.3.1`、`@fontsource/ibm-plex-mono@5.3.0`、`lxgw-wenkai-webfont@1.7.0` 的 woff2 到 `public/fonts/`（黑体 400/500/700，等宽 400/500/600，文楷 400 的 97 个 unicode 分片），**未改 package.json、未装依赖**；写了 `docs/design/FONTS.md`（含可直接粘进 globals.css 的 @font-face 与变量）。
- 证据：`node docs/design/tools/render-font-check.mjs` → `document.fonts` 106/106 loaded，三族 check 全 true；样张 `docs/design/fonts-preview.png`。
- 踩坑：文楷官方 CSS 有 97 个 @font-face，**`@import` 必须在所有普通规则之前**，放文件末尾会被浏览器静默忽略（第一次自检只有 9 个 face 就是这样）。
- 改了哪些文件：`public/fonts/**`（110 文件 / 8.1 MB）、`docs/design/FONTS.md`、`docs/design/tools/{fetch-fonts.mjs,font-faces.css,font-check.html,render-font-check.mjs}`。
- 下一步 / 阻塞：等 Lead 把 FONTS.md 3.1~3.3 粘进 `app/globals.css`（Lead 独占文件），然后跑一次 fonts-preview 确认。

## 2026-10-20 18:19 · 完成：三件器皿 SVG + 预览截图
- 做了什么：按统一规范生成 `burette.svg`（0 0 120 360，50 mL/0.1 mL）、`conical-flask.svg` 与 `beaker.svg`（0 0 160 200）；描边 #16202C@70%/1.4、玻璃 fill #fff@.5、左上 45° 单条 2px 白高光@35%、刻度 IBM Plex Mono 7px、无渐变/投影（仅底部 1px 深色边）；每件顶部注释写用途/真实规格/坐标。
- 证据：`docs/design/instruments-preview.png`（Chromium 2x 截图）、`node docs/design/tools/zoom-check.mjs`（已删，仅用于放大自检）；XML 解析通过，gradient/filter/shadow 计数均为 0。
- 决定：滴定管 0.1 mL 细刻线按真实密度画（间距 0.49px），1 倍显示并成刻度带、放大可分辨；不改成“0.5 mL 假装 0.1 mL”。
- 改了哪些文件：`public/instruments/*.svg`（3）、`docs/design/tools/{gen-instruments.mjs,render-preview.mjs,instruments-preview.html}`、`docs/design/instruments-preview.png`。
- 下一步 / 阻塞：无；下一批器皿见 ASSETS.md 第 6 节。

## 2026-10-20 18:32 · 完成：ASSETS 总账 + 全量自检
- 做了什么：写 `docs/design/ASSETS.md`（资产总表、SVG 硬规范、三件器皿坐标、UI 用法、复现命令、下一批清单）；核对 DESIGN-CONTRACT 第 5 节，器皿规范与契约一致。
- 证据：`git status` 只新增 `public/**`、`docs/design/**`、`.team/**`；未碰 `package.json/app/components/lib/config.*/strings.ts`（package.json 的改动是 Lead 加的 `shots` 脚本，与本轨道无关）。
- 改了哪些文件：`docs/design/ASSETS.md`、本 notes。
- 下一步 / 阻塞：等 Lead 验收；器皿要接入首页/操作台时按 ASSETS 第 4 节用 `<img>` 缩放，不要内联改属性。

## 2026-10-20 18:40 · 完成：SVG 内嵌等宽字体 + 终检
- 做了什么：把 IBM Plex Mono 400（latin woff2）以 base64 内嵌进三个 SVG（`<style>@font-face`），这样 `<img>` 引入、单独打开、打印都保持等宽读数，不依赖页面字体；同步更新 ASSETS.md 规范与复现说明；FONTS.md 增补 Tailwind/PostCSS 拒绝 @import 时的 `<link>` 兜底方案。
- 证据：`npm run lint` 0 error（仅 exp09 定义里另一轨道的 1 warning）；`npx tsc --noEmit` 干净；SVG XML 解析通过，gradient/filter 计数 0；`docs/design/instruments-preview.png` 2380×1160 已重截。
- 改了哪些文件：`public/instruments/*.svg`（69/21/24 KB）、`docs/design/tools/gen-instruments.mjs`、`docs/design/ASSETS.md`、`docs/design/FONTS.md`。
- 下一步 / 阻塞：等 Lead 验收 + 把 FONTS.md 3.1~3.3 接进 globals.css；本轨道无阻塞。

## 2026-10-20 19:20 · 完成：拖拽反应场景（试剂架 → 实验台 → 现象 → 事件条）
- 做了什么：`lib/scene/{types,equations,reagents,palette,resolve}.ts`：14 瓶跨实验试剂库（本实验 4 + 通用鉴定 10）、5 件器皿坐标、49 条现象表的离子方程式映射、`resolveDrop()` 解析拖放（去重、滴定管拒收、现象→特效优先级：烟雾 > 沉淀 > 气泡 > 变色 > 放热）。`components/exp/scene/*`：SVG 器皿绘制（`vessel-art`）、试剂架（HTML5 DnD + 点选 + 键盘）、实验台命中区/拖近高亮/标签、事件条。`app/scene-preview/page.tsx` 供点测。
- 证据：`npx vitest run lib/scene` 18+5+7=30 passed；`npx eslint lib/scene components/exp/scene app/scene-preview` 干净；`npx tsc --noEmit` 干净。
- 踩坑①：白色沉淀（AgCl）画成纯白后在白玻璃上“消失”→ 液体整体改成暖灰白浑浊 + 底部沉积层 + 颗粒点，肉眼能看出“变浑浊”。踩坑②：试管 B 标签另行错行、滴定管与“实验台”标签相撞 → 统一标签基线、台面字挪到右下。
- 改了哪些文件：`lib/scene/**`、`components/exp/scene/{vessel-art,bench-scene,bench,reagent-rack,drop-hint,scene.module.css}.tsx|css`、`app/scene-preview/**`、`scripts/scene-shot.mjs`。

## 2026-10-20 19:55 · 完成：8 个事故特效（爆炸 / 有毒气体 / 起火 / 暴沸 / 灼伤 / 器皿破裂 / 重金属 / 仪器损坏）
- 做了什么：`lib/scene/fx.ts` 定义 8 个键与语义色；`components/exp/scene/fx/` 每键一个 SVG+CSS 组件（爆炸：冲击环+火球+12 片碎玻璃+8 条火花；有毒气体：锥形瓶口涌绿雾+气体式；起火：酒精灯循环火焰；暴沸：液面到口+沿外壁流下+台面积液；灼伤：皮肤+灼伤斑；破裂：杯壁内放射裂纹+碎片下落；重金属：废液入水+水体变深；仪器：屏幕 ERR/OVERLOAD+火花）。全部只动 `transform`/`opacity`，`prefers-reduced-motion` 下 `animation:none` 保留静态终态。
- 证据：8 张 `%TEMP%\chemlab-shots\fx-*.png` + `fx-explosion-reduced.png`（静态终态）；`lib/scene/fx-adapter.test.ts` 7 passed（键↔组件↔语义色）。
- 踩坑：全屏特效原本铺在 720×420 舞台上被拉伸裁切（烧杯/水槽出框）→ 舞台改成 4:3、SVG 加 `preserveAspectRatio` 语义，效果改为“实验台”背景条 + 居中构图；爆炸碎片的 CSS transform 覆盖 SVG `transform` → 用外层 `<g transform=translate>` 定位、CSS 只做位移/旋转。
- 改了哪些文件：`lib/scene/{fx,fx-keys?→fx-adapter}.ts`、`components/exp/scene/fx/**`（8 组件 + `fx.module.css` + `fx-layer` + `fx-badge` + `use-fx-timer`）。

## 2026-10-20 20:45 · 完成：截图全绿 + 关键坑（Next 16 dev 跨源）
- 做了什么：`scripts/scene-shot.mjs` 一键出：桌面初始/拖起/反应中/反应后、390×844 点选路径、8 张特效峰值、reduced-motion 终态，共 15 张；全部 `%TEMP%\chemlab-shots\`。
- **关键坑（后来者必看）**：截图与点测必须用 `http://localhost:3000`，**不要用 127.0.0.1**。Next 16 dev 把 127.0.0.1 当跨源、拦掉 HMR 资源，页面 SSR 正常但**完全不 hydrate**（点了没反应、无报错），极易误判成“组件写错”。dev server 还偶尔自己挂掉（别的轨道脚本会重启），跑截图前先确认 200。
- 证据：最后一次 `node scripts/scene-shot.mjs` → 15 张全出、`无 console error`；`npx tsc --noEmit`、`npx eslint lib/scene components/exp/scene app/scene-preview`、`npx vitest run lib/scene`（30 passed）、`node scripts/check-encoding.mjs` 全绿。
- 改了哪些文件：`scripts/scene-shot.mjs`、`components/exp/scene/**`（焦点框只给键盘、白沉淀显色、标签/台面字位置）。
- 下一步 / 阻塞：无；特效若要更强可再加“液滴飞溅/玻璃反光”，但当前 8 张已能一眼认出事故类型。

## 2026-10-20 23:06 · 完成：两条 bug 修复（试管 A 装盐酸 / 滴定管拒收走 UI）
- 做了什么：① `VESSEL_SEED["tube-a"]` 从 `na2co3` 改为 `hcl`（稀盐酸），拖 Na₂CO₃ 进去即命中 `na2co3-hcl-co2`，剧烈冒泡 + `CO₃²⁻ + 2H⁺ → CO₂↑ + H₂O`；默认提示文案改成“试管 A 装稀盐酸、试管 B 装硫氰酸钾”。② 滴定管原来在 UI 层直接把 drop/click 吞掉（`droppable=false` 时 return），`resolveDrop` 的拒收文案根本到不了事件条——现在滴定管也接住 drop/click，走 resolveDrop 给「滴定管只装标准溶液，不能直接投加试剂——请把试剂拖到锥形瓶、烧杯或试管上」。
- 证据：`npx vitest run lib/scene` **32 passed**（新增 2 条：`VESSEL_SEED["tube-a"]==["hcl"]` 命中 CO₂；AgNO₃→滴定管 `ok=false` 且 caption 含「滴定管」「标准溶液」、不含“没有明显现象”）；四张截图 `scene-reaction-{agcl,cuoh2,co2,burette}.png` 事件条逐一校验 OK。
- 改了哪些文件：`lib/scene/{palette,resolve}.ts`、`lib/scene/resolve.test.ts`、`components/exp/scene/{bench,bench-scene,vessel-art}.tsx`、`scripts/scene-shot.mjs`。
- 下一步 / 阻塞：无。

## 2026-10-20 23:55 · 完成：交互反馈闭环（ix 基类）+ 成功/失败双分支演示
- 做了什么：场景内全部可点元素挂 `ix` 与语义状态类（试剂瓶、器皿、fx 按钮、读数、舞台）；器皿保持 `ix-snap`/`ix-shake`；投放目标改用**虚线环脉冲**（不放大元素本体，避免与 `:active` 的 scale(0.97) 打架）；`lib/scene/haptics.ts` 做 `navigator.vibrate`（try/catch）。新增 `lib/scene/steps.ts` + `components/exp/scene/step-demo.tsx`：第 1 步称量、第 4 步装液调零，各带正确/错误分支、两行“为什么错”、`stepStartSnapshot` 快照 + 「重做本步」，错误时播对应事故 fx。
- 证据：`node scripts/ix-audit.mjs /scene-preview` → **29/29 按下 + 29/29 悬停**；`/exp/exp09` → **18/18 + 18/18**；`node scripts/scene-interaction-check.mjs` → **22/22**（按下 ≤100ms、300ms 内出方程式/抖动弹窗、连点 3 瓶、reduced-motion、成功/失败/重做全链路）。截图：`ix-drop-agcl.png`、`ix-drop-reject.png`、`ix-step1-success.png`、`ix-step4-fail.png`、`ix-step4-success.png`、`ix-step1-reduced.png`、`ix-selected.png`。
- 踩坑：`/scene-preview` 严格审计最初 17/29，根因不是“漏挂 ix”，而是**元素在首屏之外**（fecl3 y=951、fx 按钮 y≈1498，视口 900）——审计脚本没有滚动。已在 `scripts/ix-audit.mjs` 的 `boundingBox` 前加 `scrollIntoViewIfNeeded()`（Lead 的脚本，改动已报备）。另：读数块/舞台不是按钮，为满足“所有 data-demo-id 有反馈”，读数加 `tabIndex=0` + `ix`，舞台挂 `ix`——语义上略勉强，若后续只审计可交互元素可回退。
- 改了哪些文件：`components/exp/scene/{bench,bench-scene,reagent-rack,step-demo}.tsx`、`components/exp/scene/{scene,step-demo}.module.css`、`lib/scene/{steps,haptics}.ts`、`app/scene-preview/{page.tsx,page.module.css}`、`scripts/{ix-audit,scene-interaction-check,scene-shot}.mjs`。
- 下一步 / 阻塞：`vitest.config.ts(10): 'minWorkers' does not exist`（Lead 共享文件，导致 `npx tsc --noEmit` 红）——不是本轨道；双分支演示目前只覆盖第 1/4 步，推广到 7 步要等 `app/exp` 的步骤定义 owner 对接。

## 2026-10-21 00:28 · 完成：自动演示钩子 + 30 秒事故大秀（优先级切换）
- 做了什么：① `?demo=1&reagent=&vessel=` 纯事件预设（不依赖真实拖拽）+ `window.__chemLabDemoScene = { add, reset }`；② `/scene-preview?show=fx` 事故大秀：8 个 fx 各 2.8s 自动连播，末尾总结帧（8 个事故名 + 安全要点 + 重播/退出），`data-show-index`/`data-fx-active` 供导演台读；③ 稳定性：预设与震动全程 try/catch，信息不依赖 hover，reduced-motion 下仍有静态帧。
- 证据：`node scripts/demo-show-check.mjs` → dragTo 驱动 `AgNO₃→锥形瓶` PASS（drop 后 ≤250ms 事件条含 AgCl）、`?demo=1` 直接出 Cu(OH)₂ 且 `__chemLabDemoScene` 存在、大秀 index 0→8 自动推进停总结帧、reduced-motion 有 svg、pageerror=0；截图 `show-{1-explosion,2-toxic-gas,3-fire,4-summary,5-reduced}.png`；`ix-audit /scene-preview` 29/29 按下+悬停；`vitest run lib/scene` 33 passed。
- 踩坑：给 `<a href="?show=fx">` 挂 data-demo-id 会让审计脚本“按下即跳转”，后续元素找不到 → 审计报 boundingBox 超时；入口链接不要挂 data-demo-id。
- 改了哪些文件：`app/scene-preview/{page.tsx,page.module.css}`、`components/exp/scene/bench.tsx`、`scripts/{demo-show-check,ix-audit}.mjs`（ix-audit 加了容错滚动，已报备 Lead）。
- 下一步 / 阻塞：7 步双分支按新优先级暂停（演示仍停在第 1/4 步）。
## 2026-10-21 01:22 · 7 步双分支 + 点选投放（30/30）
- 7 步双分支：`lib/scene/steps.ts` 改为从 `experiments/exp09/definition.ts` 映射（correct→成功、trap→失败 + hazard.fx/level/terminate），`step-demo.tsx` 重写为 7 步；第 2 步水入酸 L4 终止只给「重新演示」，其余失败给 44px「重做本步」回本位快照。
- 点选投放：瓶子 `data-picked="true"`，选中时所有可投放器皿出 `data-drop-target` 虚线环；点器皿与拖拽共用 `handleDrop`；Esc / 点空白取消。
- 证据：`node scripts/scene-interaction-check.mjs` → 30/30（含 7×2=14 条分支、两条路径文案逐字相等、reduced、pageerror=0）；`vitest run lib/scene` 38 passed（新增 `steps.test.ts` 6 条）；`ix-audit /scene-preview` 29/29；`tsc` 0；截图 `%TEMP%\chemlab-shots\step-{2,3,5,6,7}-ok.png`。
- 踩坑：① bench-scene 里 TS 字符串多转义 `\\"` 直接把 dev 编译搞挂，已改单引号；② 烧杯液体 rect 原 y=196 超出 viewBox 不可见，改成按 fill 计算 y/height 且 origin=bottom。
- 下一步：等 Lead 复核；7 步视觉目前 3 种器皿轮廓（烧杯/滴定管/锥形瓶）简化示意，未按每步单独细画。
## 2026-10-21 05:20 · /exp/exp09 点选投放高亮对齐（8/8）
- 根因：`/exp/exp09` 走的是 `app/exp/[id]/scene-stage.tsx`（design-lead 那套组件树），只有 `data-selected`，从来没写过 `data-drop-target`；`/scene-preview` 走 bench-scene 所以是好的。
- 改动（不碰 handler / 分支 / 文案来源）：scene-stage 的锥形瓶热区加 `data-drop-target={selectedId||draggingId}`（复用 motion.css `.ix[data-drop-target]::after` 脉冲，不动 transform）；点空白清除选中；workbench 事件条补 `data-demo-id="demo-scene-event"` 便于断言。投放仍走原 `applyReagent`（点选/拖拽同一条）。
- 证据：新增 `scripts/exp09-drop-target-check.mjs` → 8/8：点瓶 0→1、点器皿→0、拖拽后→0、两条路径文案逐字相同、Esc→0、点空白→0、pageerror=0。`scene-interaction-check.mjs` 仍 30/30，tsc 0。截图 `%TEMP%\chemlab-shots\exp09-drop-target.png`。
- 环境坑：这个 shell 的 `PLAYWRIGHT_BROWSERS_PATH` 指向 hermes tools（缺 chromium_headless_shell-1248），跑脚本前要 `$env:PLAYWRIGHT_BROWSERS_PATH="$env:LOCALAPPDATA\ms-playwright"`；dev server 需要重新起（当前已在 3000 跑着）。`/exp/exp09` 首次 goto 用 `networkidle` 会超时，用 `domcontentloaded`。
## 2026-10-21 06:34 · exp01 场景资产（方案 B 收敛版，7/7）
- 新增 2 张静态 SVG：容量瓶（`kind: "volumetric"`，注册进 SCENE_VESSELS 且 DROPPABLE_KINDS，点选高亮自动生效）；分析天平（bench 背景静态外形 `demo-scene-instrument-balance`，不接收投加、无动画，读数走 step-demo）。
- 画布 720→940：新增容量瓶 x=676 y=180 w=86 h=160；天平 translate(792 214)。
- 3 个货架条目（保留旧 id）：`demo-scene-reagent-na2co3-solid` / `-h2so4-conc` / `-water`，新分组“实验 01（配制）”。
- 证据：`scripts/exp01-assets-check.mjs` 7/7（容量瓶渲染、点选后 5 个 data-drop-target 含容量瓶、天平存在且 0 环、3 条目+旧 id、拖水有事件条、pageerror=0）；`scene-interaction-check.mjs` 30/30；`ix-audit /scene-preview` 33/33（新增 4 元素都带 ix）；`vitest run lib/scene` 43 passed（新增 assets.test.ts 5 条）；tsc 0。截图 `%TEMP%\chemlab-shots\exp01-assets.png`。
- 已知缺口：蒸馏水→容量瓶/烧杯目前落在“没有明显现象”通用提示（现象表没有水的条目）；等 exp01 definition/文案定了再接，不自己编化学解释。
## 2026-10-21 11:40 · 试剂加入动画 + 强负反馈（P0/P1/P2）
- P0 加入动画（新 `components/exp/scene/pour.tsx` + `scene.module.css` 类）：瓶身倾转 300ms → 3 滴沿二次贝塞尔飞入 300ms（错开 70ms）→ 落点涟漪 380ms（延迟 250ms）→ 液面抬升 260ms（延迟 270ms，直接抬 SVG 里锥形瓶真实液面 rect + 液面线）；总 700ms。WAAPI `el.animate()`，`cancel()` 上一次 + timer ref，不锁交互；reduced-motion 直接 1 帧切换。
- 挂载点：SceneStage（Lead 已划给 engine-core，改动保留、不再动）；`playPour` 只量坐标，动画本体在 pour.tsx；落点用实验台 SVG viewBox 360×640 的锥形瓶真实瓶口校正（投放热区是旧布局，偏上 ~150px）。
- P1 强负反馈：`fx/index.tsx` 新增冲击壳层（body 震动类 L1~L4 160/220/320/460ms、暗场 0→0.28→0、L3/L4 红色 vignette）；`fx/fx-particles.tsx` 一次性 Canvas（72 片、900ms、rAF，`document.hidden` 暂停，卸载销毁，仅 L4 explosion/glassBreak，reduced-motion 不渲染）；`workbench.tsx` 把 `ui.event.level` 传给 `FxByKey`；motion.css 只追加 `--fx-shake-* / --fx-dark / --fx-vignette`。
- 证据：`%TEMP%\reagent-fx-check.mjs` → 帧 10/350/600/800ms：drops 3 个、350ms drop translate(502,447) scale .67、ripple scale .55/op .58、液面 rect scaleY .31；800ms 全部卸载；L3 dark .28/vignette .94 + body `fx-impact-3`；L4 dark .22/vignette .84；particles canvas=1；pageerror=0；reduced：canvas=0 / fx=1 / body 无震动类；连续两次加入 pour key 变化（可打断）。截图 `%TEMP%\chemlab-shots\reagent-fx\`。
- 坑：Next dev 只允许一个实例（.next/dev/lock），多次撞到别人 3001/3002/3004；最终自起 3006 + PGLITE_DIR=.pgdata-dev12。3001 是 standalone 生产服务（`.next/standalone/server.js`），不会热更我的改动，别拿它验新代码。