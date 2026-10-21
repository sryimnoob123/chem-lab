# 品牌资产（河南大学 / 学院标识）

> 本目录只放学校与学院的**官方标识原件**，未做任何裁剪、改色或重绘。
> 版权归河南大学所有，使用范围与限制见文末「合规说明」。

## 清单

| 文件 | 内容 | 尺寸 | 格式 | 来源 URL | 下载日期 |
|---|---|---|---|---|---|
| `henan-university-emblem.png` | 河南大学圆形校徽（标准版），中英文环文 + 1912 | 218 × 214 | PNG RGBA，**白色底（非透明）** | <https://www.henu.edu.cn/images/ny/f3.png> | 2026-10-20 |
| `henan-university-lockup.png` | 校名横版：圆形校徽 + 「河南大學」+ Henan University | 260 × 73 | PNG RGBA，**白字透明底** | <https://www.henu.edu.cn/images/logo.png> | 2026-10-20 |
| `college-lockup.png` | 学院横版：院徽 + 「河南大學新能源與智能製造學院」+ College of New Energy and Intelligent Manufacturing, Henan University | 736 × 71 | PNG RGBA，**白字透明底** | <https://energy.henu.edu.cn/tpl-v2/assets/images/logo.png> | 2026-10-20 |

SHA-256（用于核对未被替换）：

```
5007816e9a704d2e004171a4ba995761f15808854c6afc2d07c1996a61786a3f  henan-university-emblem.png
87b955871fa313d878fe452990c311ec1aae8ba082141794be482f3843538092  henan-university-lockup.png
419291103d766447df0fc349e78b1551e46a91f6e3787210a44c08315ca77fc3  college-lockup.png
```

三张图均已用 `read_image` 逐张打开确认内容与尺寸（校徽为圆形标准版，非其他变体）。
合成预览见 `docs/design/brand-preview.png`。

重新下载：

```powershell
Invoke-WebRequest 'https://www.henu.edu.cn/images/ny/f3.png' -OutFile public/brand/henan-university-emblem.png
Invoke-WebRequest 'https://www.henu.edu.cn/images/logo.png' -OutFile public/brand/henan-university-lockup.png
Invoke-WebRequest 'https://energy.henu.edu.cn/tpl-v2/assets/images/logo.png' -OutFile public/brand/college-lockup.png
```

## 使用注意（设计侧必读）

- **校徽**是白底方图，不是透明底。放在米色/深色画布上会露出白色方块，请放到白色或足够浅的底块上，
  或先用白色圆角容器承托；不要用 CSS 抠图、改色、加描边/阴影。
- **两张横版是白字透明底**，在浅色背景上等于隐形，只能放在深色（如 `#16202C` 或学校标准深蓝）底上。
  建议用法：页脚/页眉的深色条、深色卡片。
- 学院横版是超宽比例（约 10.4 : 1），显示宽度低于约 320 px 时英文一行会糊，建议 ≥ 320 px 或只保留院徽。
- 校名/院名原件为**繁体字形**（「河南大學」「新能源與智能製造學院」），这是官方原图写法，不要替换成简体重排。
- 周围留白：至少保留 0.5 倍标识高度的空白，不要贴边、不要压在花纹/实验器皿上。
- 本阶段只落盘原件，**未**生成任何透明化/改色衍生版本。

## 合规说明

1. 校徽、校名、学院名均为**河南大学学校标识**，权利归河南大学所有，不属于本项目的开源许可范围。
2. 使用范围：仅限本项目《无机及分析化学实验》虚拟实验教学页面内展示，并保留来源标注
   （页脚/关于页注明「标识来源：河南大学官网 / 学院官网」）。
3. 仓库保持 **private**，不公开分发这些图片；不得单独转载、二次售卖或用于任何商业用途。
4. **对外公开发布前（课赛公开展示、公开部署链接、宣传物料、印刷品）须请示校方**，取得书面许可后再发布；
   许可未取得前，公开版本应移除或替换为自制占位标识。
5. 禁止对标识做拉伸变形、改色、加特效、拆分重组或与其他图形组合；不得以任何方式暗示学校对本项目的背书。
