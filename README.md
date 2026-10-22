# chem-lab · 无机及分析化学虚拟实验平台

> 面向《无机及分析化学实验》（03600004，36 学时，大一）的在线虚拟实验平台。
> 学生在 2D/SVG 界面上拖试剂、看现象、拿反馈；教师端看学情、导数据。

---

## 30 秒上手

```powershell
# 1) 依赖（Node 22）
npm ci

# 2) 初始化数据库（本地 PGlite，单进程独占）
$env:PGLITE_DIR = (Join-Path (Get-Location).Path ".pgdata-prod2")
npm run db:init
npm run db:demo          # 播种 40 人演示班级（可选，教师端要有数据才好看）

# 3) 构建 + 起服务
npm run build
& ".\scripts\restart-prod.ps1"     # 会同步 static 到 standalone 并启动 :3001
```

打开 **http://localhost:3001**

| 身份 | 凭证 | 落点 |
|---|---|---|
| 学生 | `20250101` / `周若曦`（登录页已预填） | `/experiments` |
| 教师 | 口令 `2026` | `/teacher` |

> ⚠️ `npm run build` 之后**必须**跑 `restart-prod.ps1`。
> Next standalone 不会自动带 `.next/static`，漏了就是"整页无样式"。

---

## 演示动线（给老师看的那条）

`门户 → 登录（点了就进）→ 我的实验（3 个重点）→ 新手教学 → 任务看板 → 拖试剂 → 正反馈 / 错误提示 → 重做 → 交卷 → 实验总结 + 导出 CSV`

- 重点实验：**exp01 仪器的认领、天平使用及溶液配制 / exp03 醋酸电离度和电离常数测定 / exp09 酸碱标准溶液的配制与浓度比较**
- 其余 7 个在「更多实验」里标「即将开放」，不可点（演示时不暴露半成品）
- 演示模式加 `?demo=1` 会多出「跳过实验」按钮：不逐步操作，直接交卷看结果

### 现场清单（2026-10-22 18:00）

**启动（两条，别多跑）**

```powershell
npm run build
& ".\scripts\restart-prod.ps1"      # 起 :3001；漏了这步整页无样式
```

打不开就手动起（等价命令）：

```powershell
$env:PORT="3001"; $env:HOSTNAME="127.0.0.1"; $env:DEVTOOLS="1"
$env:PGLITE_DIR="E:\workspace\public\NOBBBB\chem-lab\.pgdata-prod2"
node .next/standalone/server.js
```

**线上验收（2026-10-22 13:20 实测，8/8 PASS）**

| # | URL | 结果 |
|---|---|---|
| 1 | https://smnh6y8fgh.coze.site/ | PASS · 209 字 |
| 2 | https://smnh6y8fgh.coze.site/experiments | PASS · 479 字 |
| 3 | https://smnh6y8fgh.coze.site/exp/exp01?force=1&autodemo=1 | PASS · 停在实验台 → 落到 `/exp/exp01/report` |
| 4 | https://smnh6y8fgh.coze.site/exp/exp03?force=1&autodemo=1 | PASS · 落到 `/exp/exp03/report` |
| 5 | https://smnh6y8fgh.coze.site/exp/exp09?force=1&autodemo=1 | PASS · 落到 `/exp/exp09/report` |

判据：正文 <40 字符算空白页；非 2xx 算死链；控制台 error / pageerror 计入失败。以上 0 项触发。

**现场点验（:3001，5/5 PASS）**

| 动作 | 预期 |
|---|---|
| 登录页学号姓名随便填 → 提交 | 直接进 `/experiments`（演示口径放行，不卡登录） |
| 登录页切「教师」→ 一键进 | 进 `/teacher`，有班级数据 |
| 任意页右下 DEV → 展开 Dev Dock | 10 个「一键演示」热区，实测 62×32px，手点不空 |
| Dev Dock 点 exp09「一键演示」 | 进 `/exp/exp09?force=1&autodemo=1`，顶部「第 01 步 / 共 07 步」 |
| exp09 一路跑完 | 自动跳报告页，总分 **96** |

复跑命令：`node .team/online-autodemo.mjs`（线上）、`node .team/live-check.mjs`（本地 :3001）。

---

## 目录速览

```
app/                    路由与页面（App Router）
  exp/[id]/             实验台（场景 + 右栏 + 看板 + 结果条）
  experiments/          实验列表（3 个重点 + 折叠的更多）
  teacher/              教师端（学情总览 / 名单 / 学生明细）
  api/                  session / runs / teacher / runs/[id]/export
components/exp/         场景、反馈、事故、看板、新手教学
components/portal/      门户与登录（SVG 场景动效）
lib/scene/              试剂、器皿、液体混色（liquid-mix.ts）
lib/chem/               物质库与反应规则
lib/persist/            落库、重放、报告
lib/report/summary.ts   实验总结的纯函数
scripts/                验证与取证脚本
docs/design/            设计契约、动效 token、风格裁定、素材许可
.team/                  团队协作落盘（BUGS / DECISIONS / notes / handoff）
```

---

## 常用脚本

| 脚本 | 用途 | 用法 |
|---|---|---|
| `flow-smoke.mjs` | dev/生产都行，8 步冒烟 | `$env:BASE_URL="http://localhost:3001"; node scripts/flow-smoke.mjs exp01` |
| `flow-chain.mjs` | 生产专用，10 项全链路 | `node scripts/flow-chain.mjs exp01` |
| `contrast-audit.mjs` | 对比度审计（WCAG） | `node scripts/contrast-audit.mjs "/exp/exp01?force=1"` |
| `motion-audit.mjs` | 动效/触控/性能审计 | `node scripts/motion-audit.mjs` |
| `shot-workbench.mjs` | 实验台取证截图 | `node scripts/shot-workbench.mjs exp09 --advance=2` |
| `restart-prod.ps1` | 同步 static + 重启 3001 | `& ".\scripts\restart-prod.ps1"` |
| `db/seed-demo.mjs` | 播种/清空演示班级 | `node db/seed-demo.mjs [--purge]` |

---

## 当前状态（2026-10-21 晚）

**已通过**
- `tsc --noEmit` 干净 / `lint` 0 error / `vitest` 全绿 / `build` 成功
- `flow-smoke exp01`、`exp09`：各 **8/8**
- 对比度审计 `/exp/exp01`：**0 严重 / 0 偏低**
- 液体混色单测 **19/19**，实验总结单测 **10/10**

**本轮改动**
- 实验台从暗场改**亮场**（纸白 + 墨线），事故时才压暗做反差
- 液体颜色改按**化学语义**混合（红+黄不再同色），不再取"最后一次试剂"
- 实验列表改「3 个重点 + 7 个即将开放」
- 学生端与教师端彻底分开（学生端导航已无教师入口）
- 登录页预填演示账号，一键进入
- 报告页新增「本次总结」+「下载记录 CSV」
- 演示模式新增「跳过实验」，仅 `?demo=1` 可见

**已知限制**
- 随机演示数据只铺在本地 `.pgdata-prod2`，线上靠 `db/seed-demo.mjs` 重播
- 主动画仍是 SVG + CSS/WAAPI；GSAP 方案已评估（商用免费）但本轮未接入
- 7 个"即将开放"实验：内容存在、交互未打磨
- 登录仍是白名单校验（演示账号预填，不是关闭鉴权）

---

## 关键约定

完整约定见 [`AGENTS.md`](./AGENTS.md)，其中与本项目演示最相关的四条：

1. **能用 CSS 就不用库**：动效默认 CSS transition/keyframes；只有弹簧、布局/共享元素动画、退场、可打断手势才上 Motion（`motion.dev`）。GSAP / Lottie 不引；只动 `transform/opacity`，交互 ≤300ms
2. **改颜色只走 token**（`--paper` / `--ink` / `--line` / `--river-700` 等），不写字面量
3. **`data-demo-id` 一个都不许改**——演示脚本和 e2e 全靠它定位
4. **中文文件只用 `write`/`edit` 工具**，不要用 PowerShell 重定向（会变 GBK 乱码）

设计口径：[`docs/design/STYLE-20261021.md`](./docs/design/STYLE-20261021.md)（风格唯一裁定）、
[`docs/design/DESIGN-CONTRACT.md`](./docs/design/DESIGN-CONTRACT.md)、
[`docs/design/MOTION.md`](./docs/design/MOTION.md)。

素材许可：[`docs/design/ASSET-LICENSES.md`](./docs/design/ASSET-LICENSES.md)（代码依赖全部 MIT/Apache-2.0，外部素材 0 件）。
