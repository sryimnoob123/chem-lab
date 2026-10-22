# 第三方素材与许可证总账（商用合规）

> 目的：本项目**准备商用**，所以任何第三方代码/素材/字体/图形都必须能说清「来源 + 许可证 + 是否可商用 + 义务」。
> 规则见 `docs/design/STYLE-20261021.md` §6。**新增任何外部素材前先看第 5 节的准入名单。**
> 最后核对：2026-10-21（`node_modules/*/package.json` 的 `license` 字段实测）

---

## 0. 一句话结论

| 类别 | 结论 |
|---|---|
| 运行时依赖 | 7 个，全部 **MIT / Apache-2.0 / Unlicense**，均可商用 ✅ |
| 字体 | 3 族，全部 **SIL OFL 1.1**，可嵌入商用，需保留 OFL 文本 ✅ |
| 器皿 / 事故特效 / 动效 | **本项目自绘（SVG + CSS）**，版权归项目 ✅ |
| 音效 | **Web Audio 程序化合成，无素材文件**，自有版权 ✅ |
| 噪点纹理 | `feTurbulence` 运行时生成，无素材 ✅ |
| 校徽 / 校名 / 院名 | **非开源**，权利归河南大学；仅课程内展示，仓库 private，公开发布需校方书面许可 ⚠️ |
| 外部图片 / 音频 / 视频素材 | **当前 0 件**（这是刻意的，见 §5） |

**因此当前交付包对"商用"没有第三方素材风险；唯一受限项是学校标识，且已在 `public/brand/README.md` 里写明使用边界。**

---

## 1. 运行时依赖（`package.json` `dependencies`）

| 包 | 版本 | 许可证 | 可商用 | 义务 |
|---|---|---|---|---|
| `next` | 16.4.2 | MIT | ✅ | 保留版权与许可声明 |
| `react` | 19.3.1 | MIT | ✅ | 同上 |
| `react-dom` | 19.3.1 | MIT | ✅ | 同上 |
| `three` | 0.186.1 | MIT | ✅ | 同上（仅 exp09 试点用） |
| `drizzle-orm` | 0.45.4 | Apache-2.0 | ✅ | 保留 NOTICE / 许可文本 |
| `@electric-sql/pglite` | 0.5.10 | Apache-2.0 | ✅ | 同上（仅本地开发） |
| `postgres` | 3.4.9 | Unlicense（公有领域） | ✅ | 无 |

### 1.1 开发依赖（不进产物，仅记录）
`typescript`（Apache-2.0）、`vitest`（MIT）、`tailwindcss`（MIT）、`eslint`（MIT）、`@playwright/test`（Apache-2.0）、`drizzle-kit`（Apache-2.0）。

> 说明：**本项目不引入组件库 / 图表库 / 公式库**；动画库只允许 `motion.dev`，且限 `AGENTS.md` §3.1 那四类场景（弹簧、布局/共享元素、退场、可打断手势）（`DESIGN-CONTRACT.md` §9）。
> 动效一律 CSS transition / keyframes；图表是手写 SVG；音效是 Web Audio 合成。

---

## 2. 字体（`public/fonts/`）

| 字体 | 用途 | 许可证 | 许可文件 | 可商用 |
|---|---|---|---|---|
| Noto Sans SC 400/500/700 | 正文、标题、表格 | SIL OFL 1.1 | `public/fonts/noto-sans-sc/LICENSE.txt` | ✅ |
| LXGW WenKai（霞鹜文楷）400 | 旁注、安全提示引文、演示字幕 | SIL OFL 1.1 | `public/fonts/lxgw-wenkai/OFL.txt` | ✅ |
| IBM Plex Mono 400/500/600 | 刻度、读数、有效数字 | SIL OFL 1.1 | `public/fonts/ibm-plex-mono/LICENSE.txt` | ✅ |

**OFL 义务**：不得单独售卖字体本体；保留许可文本；改名分发时须另起名。本项目只是嵌入展示，合规。

**已做的本地化**：三族字体全部落在 `public/fonts/`，**不热链 Google Fonts / CDN**（热链既不可靠也有许可与隐私问题）。

---

## 3. 品牌资产（`public/brand/`）—— 非开源，受限

| 文件 | 权利 | 可商用 | 使用边界 |
|---|---|---|---|
| `henan-university-emblem.png` | 河南大学 | ❌ 未经书面许可不可 | 仅本课程教学页面展示 |
| `henan-university-lockup.png` | 河南大学 | ❌ | 同上 |
| `college-lockup.png` | 河南大学新能源与智能制造学院 | ❌ | 同上 |
| `brand/campus/campus-0*.jpg` | 河南大学官网 / 学院官网 | ❌ | 课程内展示，不作宣传物料 |

完整合规说明见 [`public/brand/README.md`](../../public/brand/README.md)（含 SHA-256、来源 URL、下载日期、禁用行为）。

**发布前动作（必须）**：
1. 仓库保持 private，不公开分发标识原件；
2. 对外公开演示（课赛、公网宣传）前**取得校方书面许可**；
3. 许可未取得前，公开版本替换为自制占位标识（灰阶文字标 + 课程名）。

---

## 4. 本项目自有资产（版权归项目，可随代码分发）

| 资产 | 位置 | 形式 |
|---|---|---|
| 器皿 SVG（滴定管 / 锥形瓶 / 烧杯 / 容量瓶 / 量筒 / 洗瓶 / 坩埚 / 称量瓶 / 漏斗 / 铁架台） | `components/exp/scene/vessel-art.tsx`、`public/instruments/*.svg`、`docs/design/tools/gen-instruments.mjs` | 手写几何，脚本生成 |
| 事故特效 8 类 | `components/exp/scene/fx/**` | 纯 SVG + CSS |
| 动效 token 与状态类 | `app/styles/motion.css`、`app/styles/svg-motion.css` | CSS |
| 音效 | `lib/audio/**` | Web Audio 程序化合成（**无音频文件**） |
| 噪点纹理 | `feTurbulence` 内联滤镜 | 运行时生成 |
| 图标（动作 24×24） | `components/exp/scene/**` | 手绘线稿 |

> 自绘资产的优势正好落在商用上：**没有第三方素材，就没有素材授权链条要追溯。**

---

## 5. 外部素材准入名单（新增前必查）

### 5.1 可以引入（商用友好）

| 许可证 | 允许 | 义务 |
|---|---|---|
| MIT / ISC / BSD-2 / BSD-3 / Apache-2.0 | ✅ | 保留版权与许可声明，Apache 需附 NOTICE |
| CC0 1.0 / Public Domain | ✅ | 建议仍署名（体现专业性） |
| CC-BY 4.0 | ✅ | **必须**署名 + 注明是否修改 |
| SIL OFL 1.1（字体） | ✅ | 保留 OFL 文本 |
| CC-BY-SA 4.0 | ⚠️ 仅静态素材 | 衍生作品须同许可；**禁止入代码/字体** |

### 5.2 禁止引入

| 许可证 / 状态 | 原因 |
|---|---|
| GPL-2.0 / GPL-3.0 / AGPL-3.0 / LGPL | 传染性，商用闭源分发有法律风险 |
| CC-BY-NC / NC-SA / NC-ND | 明确禁止商用 |
| CC-BY-ND | 禁止修改（我们要改色改尺寸，必然违约） |
| 无许可证 / "仅供学习" / 来源不明 | 默认保留全部权利，不可用 |
| 带水印图库图、AI 生成位图冒充手绘 | 质量与授权双风险 |
| 热链 CDN 的字体/图片 | 可用性 + 许可 + 隐私三问题 |

### 5.3 登记表（新增素材必须填，一行一件）

| 日期 | 素材名 | 类型 | 来源 URL | 版本/日期 | 许可证 | 是否修改 | 用途 | 许可文件落盘 |
|---|---|---|---|---|---|---|---|---|
| —— | （当前无） | | | | | | | |

> 登记后：许可原文放 `public/licenses/<name>/LICENSE`（或 `LICENSE.txt`），
> 并在根目录 `NOTICE` 追加一行；代码/样式里引用处加注释指回本表。

---

## 6. 发布前合规清单

- [ ] `package.json` 无新增依赖，或新增项已进 §1 且许可证在 5.1 白名单
- [ ] 外部素材全部登记在 §5.3，许可原文已落盘
- [ ] 三族字体的 OFL/LICENSE 文件仍在 `public/fonts/**`
- [ ] 根 `NOTICE` 包含全部第三方组件与素材
- [ ] 学校标识：private 仓库 + 课程内使用；公开发布前已取得书面许可或已替换占位
- [ ] 无 CDN 热链（字体/图片/脚本）
- [ ] 无 GPL/AGPL/NC/ND 资产
- [ ] 音效仍为程序化合成（未偷偷加 .mp3/.wav）

---

## 7. 复现核对

```powershell
# 依赖许可证
node -e "const fs=require('fs');for(const p of Object.keys(require('./package.json').dependencies)){const j=JSON.parse(fs.readFileSync('node_modules/'+p+'/package.json','utf8'));console.log(p,j.version,j.license)}"

# 确认无音频/图片素材偷偷进包
Get-ChildItem public -Recurse -Include *.mp3,*.wav,*.ogg,*.m4a | Select-Object FullName
```
