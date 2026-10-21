# Lead 交接：第 6 轮（2026-10-21 11:46）

## 这一轮做完了什么（全部已合并进工作树，未提交）

### 1. 首页 / 登录页（design-lead）
- `app/page.tsx`：白底；校园图轮播 8 张（`public/brand/campus/campus-*`，官网 henu.edu.cn 抓取，已压缩共 472 KB）；
  `object-fit: cover`，无 scale 推近；停留 8200ms、交叉淡入 1200ms、旧图延迟 220ms；
  删掉三张说明卡（十个实验 / 做错会出后果 / 过程性评价），换成 **3 张实验卡**（01/02/09）+「查看全部 10 个 →」；
  READY / telemetry 已删；主 CTA 只留「登录开始实验」
- `app/login/page.tsx`：`components/portal/lab-scene.tsx` 暗场实验台 SVG 铺满，静态不轮播；白卡居中（430 / 390 时 358）；
  输入框 48px、tab 46px、按钮 50px；去掉解释性 placeholder
- `components/portal/campus-slides.tsx`：交叉淡入实现
- 截图：`%TEMP%\chemlab-shots\design-lead\{home-1440,home-390,login-1440,login-390}.png`

### 2. 全站 Motion 过渡（pedagogy-engine）
- `app/globals.css` 新增 `.ix-page-enter`(260ms) / `.ix-fade-in` / `.ix-leave`(160ms) / `.ix-reveal`(40ms 错峰, 封顶 200ms) / `.ix-lift`
- `components/motion/reveal.tsx`、`app/experiments/page.tsx`、`app/exp/[id]/{page,workbench}.tsx`、`components/exp/bopbps-gate.tsx`、`app/exp/[id]/report/page.tsx`
- 前测→操作台：`.ix-leave` 160ms 退场 → 操作台淡入；reduced-motion 直接切换

### 3. 教师端雷达图（teacher-console）
- `components/teacher/{radar-data.ts,radar-query.ts,radar-chart.tsx,radar-chart.module.css}` + `radar-data.test.ts`（13 用例）
- `/teacher` 雷达放在事故分布与台账之间；`/teacher/student/[no]` 置顶复用同一组件（`scope` 只换文案）
- 口径：逐 run `computeMastery` → 每维只对有该能力码的 run 求平均；缺维 value=0 + `hasData:false` + 图例「暂无数据」
- 截图：`%TEMP%\chemlab-shots\teacher-chart\teacher-1440.png`（K1 82 / K2 80 / A1 93 / S1 83 / S2 92）

### 4. three.js 试点（engine-core）
- 已装 `three@0.186.1` + `@types/three`（唯一新增依赖）
- `components/scene3d/{vessel-mesh.tsx,titration-scene.tsx,scene3d.module.css}`；`app/exp/[id]/scene-stage.tsx` 加 `?scene=3d` 分支 + `useScene3d()`
- 数字：3D chunk **189.1 KB gzip**（默认 2D 路径 0 额外体积）；headless 240 fps；390 宽无溢出；无 WebGL 时降级文案
- **默认仍是 2D**，3D 仅 `?scene=3d`（且只对 exp09 生效）
- 结论：资产是瓶颈（B 级器皿 10~12 件要出 3D 版，≈1 工作日/件），建议先 build 实测真 chunk 再决定推广

### 5. 试剂加入动画 + 强弱反馈（asset-pipeline）
- 新增 `components/exp/scene/pour.tsx`：瓶身倾转 -14°(300ms) → 3 滴贝塞尔飞入(0/70/140ms) → 涟漪(250ms,380ms) → 液面抬升(270ms,260ms) → 700ms 卸载；可被下一次打断
- 新增 `components/exp/scene/fx/fx-particles.tsx`：**L4 爆炸/碎裂**一次性 Canvas 粒子（72 片 / 900ms / rAF / hidden 暂停 / 卸载销毁）
- `fx/index.tsx` 冲击壳层：震动分级 L1~L4（160/220/320/460ms）、L3/L4 暗场 0.28、红色 vignette
- `app/styles/motion.css` 追加 `--fx-shake-1..4 / --fx-dark / --fx-vignette`
- 截图：`%TEMP%\chemlab-shots\reagent-fx\`

### 6. `/dev` 开发者调试面板（data-api）
- `app/dev/{page.tsx,debug-data.ts}` + `components/devtools/*`
- 功能：10 实验总览、四类直达（force/report/demo/hazard）、清前测缓存、一键登录、runId + timeline、29 个 hazard 一键注入
- 开关：`DEVTOOLS=1` 强制开 / `0` 强制关 / 未设置时仅非 production；关闭时 `notFound()` + robots noindex + 全站无入口
- 生产行为：不设变量 → 404；要线上排障临时 `DEVTOOLS=1` 重部署
- 截图：`%TEMP%\chemlab-shots\devtools\`

### 7. 配套脚本（Lead）
- `scripts/restart-prod.ps1`：停 3001 → 同步 `.next/static` 与 `public` 到 standalone → 启动 → 验首页/图片/preview
- `scripts/grab-campus-images.mjs`（抓官网图）、`scripts/compress-campus.mjs`（Playwright 压图，无第三方库）
- `scripts/shot-home-login.mjs`、`scripts/shot-cover.mjs`、`scripts/preview-page.mjs`
- `docs/进度与计划.md`（给用户看的进度表）

## 验证状态（合并后跑过）
- `npx tsc --noEmit` → 0
- `npm run lint` → 0 error / 8 warning（历史遗留，非本轮）
- `npx vitest run` → **407 passed / 24 files**
- `npm run build` → **成功**（11:44）

## 正在进行 / 下一步
1. **restart-prod.ps1 在后台跑**（job `pwsh-ba2cc20b41a54567`）——确认 3001 起来、`/` 200、`brand/campus/campus-02.jpg` 200、`preview.html` 200
2. 重启后跑：`npx playwright test`（E2E_BASE_URL=http://localhost:3001）、`node scripts/bopbps-all.mjs`
3. 视觉验收：首页/登录/实验/教师/dev 截图各一张
4. `git add -A && git commit && git push`（当前 HEAD `da46e5d`）
5. 未做：**实验分层解锁**（基础→进阶→设计），等用户拍板分组方案

## 环境铁律（踩过的坑，别重复）
- 重启必须走 `restart-prod.ps1`（Next standalone 启动时才扫 `public/`，漏同步 ⇒ 404 / 老代码）
- **build 前必须先停 3001**，否则 `.next/standalone` 被占用 ⇒ `rmdir ... standalone` 失败
- 本机 `pwsh` 不在 PATH，用 `powershell -NoProfile -ExecutionPolicy Bypass -File`
- 访问一律 `http://localhost:3001`，不要 `127.0.0.1`（HMR/水合问题）
- 同一 checkout 同时只能跑一个 `next dev`
