# 设计资产清单与规范（ASSETS）

> 本文件是「实验记录本 + 试剂标签」视觉系统的资产总账：有什么、放哪、什么规格、怎么复用、怎么重生成。
> 更新日期 2026-10-20（D0 晚）。新增器皿时请同步本文件与 `docs/design/instruments-preview.png`。

## 1. 资产总表

| 类别 | 路径 | 内容 | 状态 |
|---|---|---|---|
| 品牌 | `public/brand/*.png` + `README.md` | 圆形校徽、校名横版、学院横版（官方原件） | ✅ 3/3，含合规说明 |
| 器皿 SVG | `public/instruments/*.svg` | 滴定管、锥形瓶、烧杯 | ✅ 3 件（本阶段范围） |
| 字体 | `public/fonts/**` | Noto Sans SC、LXGW WenKai、IBM Plex Mono（woff2） | ✅ 已落盘，待 Lead 接入 `globals.css` |
| 预览留证 | `docs/design/instruments-preview.png` | 三件器皿总览截图 | ✅ |
| 预览留证 | `docs/design/brand-preview.png` | 三张品牌图在正确底色上的合成 | ✅ |
| 预览留证 | `docs/design/fonts-preview.png` | 三族字体样张 + 加载自检 | ✅ |
| 规范 | `docs/design/FONTS.md` | 字体安装/接入说明 | ✅ |

字体细节见 [FONTS.md](./FONTS.md)；品牌来源与合规见 [public/brand/README.md](../../public/brand/README.md)。

## 2. 器皿 SVG 统一规范（硬约束）

| 项 | 规则 |
|---|---|
| 画布 | 高瘦器皿 `viewBox="0 0 120 360"`；矮胖器皿 `viewBox="0 0 160 200"`。同类器皿只用一个尺寸系，靠 `width/height` 缩放 |
| 玻璃描边 | `#16202C`，`stroke-opacity="0.7"`，`stroke-width="1.4"`，单层描边，不做玻璃厚度双线 |
| 玻璃填充 | `fill="#fff" fill-opacity="0.5"`（即 `rgba(255,255,255,.5)`）；只填玻璃腔体，刻度线/高光在填充之上 |
| 光源 | 统一左上 45°，**每件器皿只有一条** `stroke="#fff" stroke-opacity="0.35" stroke-width="2"` 的高光，`linecap="round"`，沿左侧内壁 |
| 刻度 | 字体 `"IBM Plex Mono", "IBM Mono", monospace`，`font-size="7"`；刻度用 `#16202C @0.7`；量程/分度与真实器皿一致。每个 SVG 内嵌 400 字重 woff2（base64），`<img>` 引入 / 单独打开 / 打印都不丢等宽字体 |
| 禁止 | 渐变洗底、投影、模糊、滤镜、图片纹理、描边渐变；唯一允许的“投影”是器皿底部一条 `1px` 深色边（`#16202C @0.55`） |
| 语义 | 根元素带 `role="img"` + `aria-label`；文件顶部注释写用途、真实规格、坐标说明 |
| 命名 | kebab-case，英文常用名：`burette.svg` / `conical-flask.svg` / `beaker.svg` |

坐标约定：`x` 向右、`y` 向下；器皿中轴居中；外轮廓坐标写在注释里，方便后续做液面/气泡/动画时对齐。

## 3. 本阶段三件器皿

### 3.1 `burette.svg` — 50 mL 酸式滴定管

- 画布 `0 0 120 360`（高瘦系）。
- 真实规格：50 mL、酸式玻璃旋塞、最小分度 0.1 mL、按 0.01 mL 估读。
- 几何：管身 `x=47..73`，瓶口 `y=14`（`x=45..75` 微扩口），0 mL 在 `y=52`，50 mL 在 `y=296`（4.88 px/mL）；
  旋塞 `y=300..316`（含横向旋柄），下尖嘴 `y=316..342`。
- 刻线：0.1 mL 细线 + 0.5 mL 短线 + 1 mL 中线 + 5 mL 长线带数字（0/5/…/50）。
  0.1 mL 线间距 0.49 px，是**按真实密度**画的：1 倍尺寸时并成刻度带（真机照片也如此），放大到 2 倍以上可分辨，保证矢量化时不丢数据。
- 数据属性：`data-range="0-50" data-min-division="0.1"`（供后续读数组件取量程，不用在 TS 里硬编码）。

### 3.2 `conical-flask.svg` — 250 mL 锥形瓶

- 画布 `0 0 160 200`（矮胖系）。
- 真实规格：250 mL 广口锥形瓶，瓶口外径约 34 mm，瓶底约 85 mm，总高约 145 mm。
- 几何：瓶口 `x=63..97 / y=16`（顶部有 1.4 px 唇线 `x=60..100`），瓶颈到 `y=62`，肩部直线展开至瓶底 `y=184`，
  底宽 `x=32..128`，四角 R6 圆角；250 mL 标线 `y=99`，数字在标线上方。
- 只画 250 mL 一条标线（该瓶为单标线容量瓶式锥形瓶，真实瓶身只有 250 一条刻度）。

### 3.3 `beaker.svg` — 250 mL 烧杯

- 画布 `0 0 160 200`（矮胖系）。
- 真实规格：250 mL 低型烧杯，外径约 70 mm、高约 95 mm；烧杯刻度为近似量取，最小分度 10 mL。
- 几何：杯口椭圆 `(80,41) rx=54 ry=7.5`，杯身 `x=26..134`，底 `y=188`；0 mL → `y=184`，250 mL → `y=56`（0.512 px/mL）。
- 刻线：10 mL 短线，50 mL 主刻度带数字（50/100/150/200/250），数字放在刻线右侧。

## 4. 怎么用（给 UI 侧）

- 静态资源走根路径：`/instruments/burette.svg`、`/brand/henan-university-emblem.png`、`/fonts/...`。
- 优先 `<img src="/instruments/burette.svg">` 或 CSS `background-image`；**不要**把 SVG 内联成 JSX 再逐件改属性，
  否则统一规范会被组件破坏（要改状态就整体换一个 SVG 或加覆盖层）。
- 尺寸只按高度缩放（`height: 320px; width: auto`），不要非等比拉伸；标题/说明文字不要画进 SVG。
- 器皿颜色是固定的墨蓝 `#16202C`，放在米色记录本纸面（建议 `#f1eee6` ~ `#fbfaf7`）或白底上；
  玻璃填充是半透明白，深色底上会偏灰，深色场景请单独出一版（当前未做）。
- 器皿不要加 `drop-shadow`，需要“落桌感”用底部那条 1px 深色边即可。

## 5. 复现 / 重生成

```powershell
node docs/design/tools/gen-instruments.mjs    # 生成 public/instruments/*.svg
node docs/design/tools/render-preview.mjs     # 重新截 instruments-preview.png / brand-preview.png
node docs/design/tools/fetch-fonts.mjs        # 重新下载字体（幂等，覆盖）
node docs/design/tools/render-font-check.mjs  # 字体加载自检 + fonts-preview.png
```

工具目录：`docs/design/tools/`
（`gen-instruments.mjs` 是唯一手写几何的来源，改器皿请改脚本再重跑，不要直接改 SVG，否则下次生成会被覆盖。
脚本会读取 `public/fonts/ibm-plex-mono/ibm-plex-mono-latin-400-normal.woff2` 内嵌进 SVG，缺字体文件时生成会失败。）

## 6. 已知限制 / 下一批

- 滴定管 0.1 mL 刻线在 1 倍视图下不可分辨（物理限制，见 3.1）；若交互需要逐 0.1 mL 高亮，用覆盖层画读数线，不要改 SVG 刻线。
- 校徽为白底方图、两张横版为白字透明底，使用场景受限（详见 `public/brand/README.md`）。
- 霞鹜文楷只有 400 字重。
- 下一批器皿（沿用同一规范）：`volumetric-flask.svg`（250 mL 容量瓶）、`pipette.svg`（25 mL 移液管）、
  `graduated-cylinder.svg`（100 mL 量筒）、`weighing-bottle.svg`（称量瓶）、`wash-bottle.svg`（洗瓶）、
  `iron-stand.svg`（铁架台 + 滴定管夹）、`electronic-balance.svg`（电子天平，读数屏用等宽字体）。
  容器类考虑再加“液面 / 气泡 / 滴定终点”覆盖层，而不是复制三份带液体的 SVG。
- 本阶段未做 favicon / og-image / 空状态插画；等品牌页定稿后再从校徽派生（派生图须遵守合规说明）。
