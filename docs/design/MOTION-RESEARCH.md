# 动效调研：把「实验台」做出设计感

> 产出时间：2026-10-21 · 作者：design-lead
> 目的：登录页/首页背景被用户否了两版（一版纯线稿「太业务」、一版太淡「太空」）。
> 这份文档回答：**别的优秀项目到底是怎么把「静物插画」做活的**，以及哪些技法能原样搬到本项目（Next 16 + CSS Modules + 纯 CSS 动画，不引动画库）。
> 配套执行文档：`docs/design/LOGIN-SCENE-GUIDE.md`（怎么落地）。

---

## 0. 一句话结论

奖站（Awwwards SOTD）的做法**不是**「加更多元素」，而是：

> **一层静、一层动、一个签名瞬间。**
> 静态部分像一张印刷品（严格网格、稳定构图、克制配色），动态只发生在 3~5 个点上，且每个动的点都对应一个「物理因果」。

我们前两版的问题正好相反：第一版全是线稿（没有质感承载「静」），第二版加了颜色但全部在「静止/微动」，**没有一个被记住的瞬间**。

---

## 1. 参考项目（按可迁移度排序）

### 1.1 直接对标：实验台 / 科学插图类

| 参考 | 做了什么 | 我们能抄什么 |
|---|---|---|
| **Awwwards SOTD 评审口径**（[awwwards skill](https://sandrohub013.github.io/awwwards-skill/)） | 4 项加权：设计 40 / 可用性 30 / 创意 20 / 内容 10；「一个签名瞬间胜过二十个特效」 | **不要铺满特效**。整个页面挑 1 个记忆点（= 滴定落液），其余全部降级为环境动效 |
| **Bittercreek.Studio**（[awwwards](https://www.awwwards.com/bittercreek-studio.html)） | 严格网格 + 编辑式排版 + 「微妙微交互」，自述「从不显得用力过猛」 | 台面线 = 网格；器皿是「静物」，靠位置和尺寸讲话 |
| **Working Stiff Films**（[awwwards case](http://www.awwwards.com:8080/working-stiff-films-case-study.html)） | 「不要 GPU 重技术也要有运动感」；用 pacing（节奏）而非粒子 | 纯 CSS + 2 条 keyframes 也能成立 |
| **Instruments / blueprint 类图**（`docs/design/instruments-preview.png` 已有） | 描边 + 填充 + 单一高光，无渐变无阴影 | 与 `vessel-art.tsx` 同一套，已验证 |


### 1.2 技法对标：静物怎么动

| 参考 | 技法 | 迁移到我们 |
|---|---|---|
| **SVG line-draw**（[GSAP DrawSVG](https://gsap.com/docs/v3/Plugins/DrawSVGPlugin/) / [SO: stroke-dashoffset](https://stackoverflow.com/revisions/2e27ad30-31a4-423b-a785-4c7a2612b7af/view-source)） | `stroke-dasharray = 路径长`，`stroke-dashoffset` 从长到 0，线条像被笔「画出来」 | 登录页首帧：器皿轮廓 1.6s 逐件描出（stagger 120ms），**只播一次**，播完就是静止插画 |
| **Motion Narrative**（[Squarespace Circle](https://pros.squarespace.com/blog/motion-narrative-design-trend)） | 动效承担叙事，不是装饰；「移位排版 + 交互视场」 | 液滴下落 = 「正在滴定」这件事本身，不是随机浮动 |
| **Resn 式 scroll storytelling**（[recipe](https://github.com/ConardLi/garden-skills/blob/main/skills/web-design-engineer/references/style-recipes/resn-storytelling.md)） | 每段是一个「场景」，场景有自己的美术指导；结尾有奖励 | 登录页 = 一个场景（滴定）；不要在登录页塞第二个故事 |
| **Tectonic 堆叠微交互**（[freefrontend](https://freefrontend.com/code/tectonic-stacked-tooltip-button-2026-02-08/)） | 多层 `translate` 错位展开 + `cubic-bezier(0.19,1,0.22,1)` | 登录卡入场用多层（蒙版 + 卡片 + 内容三级）错峰，比单层 fade 有厚度 |
| **AwardsCSS / ReactBits 技法分类**（[awardscss](https://www.npmjs.com/package/awardscss)、[reactbits 拆解](https://raw.githubusercontent.com/mcorbett51090/RavenClaude/refs/heads/main/plugins/web-design/knowledge/design-sources/reactbits.md)） | 背景类：aurora / 粒子 / 网格地板；文字类：逐字 stagger / 滚动点亮；UI 类：magnetic / hover 揭示 | 我们只借 **网格地板 + 逐字/逐行 stagger + hover 揭示**，粒子与 WebGL 全弃（会盖过实验内容） |
| **Noise / grain 图层**（同上 & [tectonic](https://freefrontend.com/code/tectonic-stacked-tooltip-button-2026-02-08/)） | 极淡噪点叠一层，消除「数字平涂感」 | 登录页 + 首页各加一层 `feTurbulence` 噪点，opacity 0.025，`mix-blend-mode: multiply` |

### 1.3 平面设计侧（不依赖网页）

- **瑞士国际主义**：一条基线、严格左对齐、字号对比拉开（H1 : 正文 = 5:1 以上）。→ 登录卡内部已有，背景器皿也要「坐在同一基线上」（台面线）。
- **科学铜版画 / 植物图鉴**：主体大、留白多、标注细。→ 器皿占背景面积的 15~20% 就够，不要铺满。
- **丝网印刷套色**：单色 + 一个强调色。→ 底座蓝 `#23307F` + 一个试剂色（酚酞粉）作为全页唯一彩色。

---

## 2. 可迁移技法清单（带本项目可用度评分）

| # | 技法 | 效果 | 成本 | 本项目可用度 | 备注 |
|---|---|---|---|---|---|
| 1 | `stroke-dashoffset` 逐件描绘 | 器皿「被画出来」 | 低（纯 CSS + 每件一个 `pathLength=1`） | ★★★★★ | 登录页首屏必做，播一次 |
| 2 | 落液滴 + 液面涟漪 | 签名瞬间 | 低 | ★★★★★ | 已有 drop；涟漪待加 |
| 3 | 液面 `scaleY` 呼吸 | 液体的「活」 | 低 | ★★★★★ | 已有 3.5s |
| 4 | 气泡上浮 | 溶液在反应 | 低 | ★★★★★ | 已有 8s |
| 5 | 器皿 hover 揭示（背景级） | 鼠标掠过时某件变清晰 | 低 | ★★★★☆ | 登录页背景可做：hover 到锥形瓶 → 该件 opacity 升到 0.9 |
| 6 | 指针视差（两层不同速度） | 纵深感 | 低（`translate3d` + `--px/--py`） | ★★★★☆ | 近景 1.2x、远景 0.4x；reduced-motion 关 |
| 7 | 网格地板透视 | 空间 | 中 | ★★☆☆☆ | 登录页已用蓝图网格，够了 |
| 8 | 噪点 grain | 去掉数字感 | 低 | ★★★★☆ | 建议加 |
| 9 | 逐字/逐行 stagger 揭示 | 文案有节奏 | 低 | ★★★☆☆ | 首页列表可用，登录卡标题可用 |
| 10 | 卡片多层错峰入场 | 厚度 | 低 | ★★★★☆ | 登录卡升级 |
| 11 | 磁吸按钮 / 自定义光标 | 手感 | 中 | ★☆☆☆☆ | 与「教学工具」气质冲突，弃 |
| 12 | WebGL / 粒子 | 视觉冲击 | 高 | ★☆☆☆☆ | 盖过实验内容 + 扣子部署吃性能，弃 |
| 13 | 滚动驱动（`animation-timeline: view()`） | 滚动叙事 | 低 | ★★★☆☆ | 首页可做，需 `@supports` 兜底 |

**取舍原则**：凡是「让背景抢了实验内容」的一律不做；凡是「能解释成物理因果」的一律做。

---

## 3. 用户两次否掉的原因（复盘）

| 版本 | 用户原话 | 真实问题 | 结论 |
|---|---|---|---|
| v1 纯线稿 11 件 | 「太业务，像仪器说明书」 | 只有 `stroke` + `fill:none`，**没有材质**（无玻璃填充、无高光、无液体色） | 视觉语言必须与实验页 `vessel-art.tsx` 同源 |
| v2 有材质但全静止微动 | 「可以把动态效果做多一点」 | **没有签名瞬间**；动的都是「呼吸级」的微动，远看等于静止 | 每屏至少 1 个「一眼能说出名字」的动效 |

用户第三次的要求原话：
> 「可以去参考一下比较优秀的一些项目，就不一定是这种类似的项目，还可以是那种视觉效果、平面设计的那种效果。」

→ 即：**允许抽象、允许平面化**，不必全部写实成实验台。

---

## 4. 下一版该长什么样（给接手的对话）

优先级从高到低：

1. **首帧描绘**：器皿轮廓 1.6s 依次画出（stagger 120ms），只播一次 → 建立「这是插画，不是截图」的暗示。
2. **签名瞬间**：滴定管液滴 2.4s 落到锥形瓶，落点处一圈极淡粉色涟漪扩散 600ms（`scale 0.6→2.2` + opacity 0.35→0）。
3. **环境层**：液面 3.5s 呼吸、气泡 8s 上浮、烧杯内液体极缓对流（2 个不同相位）。
4. **指针视差**：`--px/--py` 两层不同幅度，`translate3d` 限制 ±10px，`prefers-reduced-motion` 关。
5. **噪点层**：`feTurbulence` 一张 128×128 平铺，opacity 0.025。
6. **登录卡入场**：蒙版 → 卡片 → 内部三行错峰 80ms。

---

## 5. 参考链接汇总

- Awwwards 评审体系拆解：https://sandrohub013.github.io/awwwards-skill/
- Bittercreek.Studio（编辑式 + 微交互）：https://www.awwwards.com/bittercreek-studio.html
- Working Stiff Films（轻量运动叙事）：http://www.awwwards.com:8080/working-stiff-films-case-study.html
- GSAP DrawSVG（线稿描绘原理）：https://gsap.com/docs/v3/Plugins/DrawSVGPlugin/
- stroke-dashoffset 动画问答：https://stackoverflow.com/revisions/2e27ad30-31a4-423b-a785-4c7a2612b7af/view-source
- Motion Narrative 趋势：https://pros.squarespace.com/blog/motion-narrative-design-trend
- Resn 式场景叙事配方：https://github.com/ConardLi/garden-skills/blob/main/skills/web-design-engineer/references/style-recipes/resn-storytelling.md
- 2025–2026 趋势 / 性能分层 / reduced-motion：https://github.com/Eneryleen/ai-web-design-codex/blob/main/07-aesthetics-and-trends/trends-2025-2026.md
- 技法分类参考（ReactBits）：https://raw.githubusercontent.com/mcorbett51090/RavenClaude/refs/heads/main/plugins/web-design/knowledge/design-sources/reactbits.md
- 纯 CSS 高阶动效库（AwardsCSS）：https://www.npmjs.com/package/awardscss
- 多层堆叠微交互案例：https://freefrontend.com/code/tectonic-stacked-tooltip-button-2026-02-08/
