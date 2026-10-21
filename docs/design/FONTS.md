# 字体方案（FONTS）

> 状态：字体文件已**下载落盘**，未改 `package.json`、未装任何 npm 依赖。
> 剩余动作只有一处：把下面的 `@font-face` + 变量粘进 `app/globals.css`（Lead 独占文件，由 Lead 执行）。

## 1. 三个角色

| 角色 | 字体 | 字重 | 用在哪 |
|---|---|---|---|
| 正文 / 界面 | 思源黑体 **Noto Sans SC** | 400 / 500 / 700 | 标题、正文、按钮、导航、表头；实验步骤正文 |
| 旁白 / 引文 | 霞鹜文楷 **LXGW WenKai** | 400 | 实验记录本式旁白、注意事项、引文、教师点评 |
| 读数 / 数据 | **IBM Plex Mono** | 400 / 500 / 600 | 体积读数、滴定管刻度、数据表、时间线时间戳、代码/参数 |

设计取向：「实验记录本 + 试剂标签」——黑体保证信息密度与可读性，文楷只做少量语气缓冲，等宽体让读数对齐、像仪器面板。

## 2. 已落盘文件（`public/fonts/`）

全部为 **woff2**，来源 npm 包（经 jsDelivr CDN 取原始文件），下载日期 2026-10-20，脚本 `docs/design/tools/fetch-fonts.mjs` 可重跑。

```
public/fonts/
├── noto-sans-sc/                         (3,436 KB / 7 files)
│   ├── noto-sans-sc-chinese-simplified-400-normal.woff2   1,142,552 B
│   ├── noto-sans-sc-chinese-simplified-500-normal.woff2   1,159,128 B
│   ├── noto-sans-sc-chinese-simplified-700-normal.woff2   1,172,244 B
│   ├── noto-sans-sc-latin-400-normal.woff2                   13,304 B
│   ├── noto-sans-sc-latin-500-normal.woff2                   13,324 B
│   ├── noto-sans-sc-latin-700-normal.woff2                   13,416 B
│   └── LICENSE.txt                                        OFL 1.1
├── ibm-plex-mono/                        (49 KB / 4 files)
│   ├── ibm-plex-mono-latin-400-normal.woff2                  14,708 B
│   ├── ibm-plex-mono-latin-500-normal.woff2                  14,888 B
│   ├── ibm-plex-mono-latin-600-normal.woff2                  15,620 B
│   └── LICENSE.txt                                        OFL 1.1
└── lxgw-wenkai/                          (4,633 KB / 99 files)
    ├── lxgwwenkai-regular.css            97 个 @font-face 分片（带 unicode-range，官方原样）
    ├── files/lxgwwenkai-regular-subset-*.woff2   97 个分片
    └── OFL.txt                            OFL 1.1
```

合计约 **8.1 MB / 110 文件**。字体均为 SIL Open Font License 1.1，允许自托管与再分发（保留 OFL 文本）。

取文件用的版本（写进 commit message，便于回溯）：

- `@fontsource/noto-sans-sc@5.3.1`
- `@fontsource/ibm-plex-mono@5.3.0`
- `lxgw-wenkai-webfont@1.7.0`

## 3. 交给 Lead 的改动（只动 `app/globals.css`）

### 3.1 在文件最顶部追加（`@import` 必须在所有普通规则之前）

```css
@import "tailwindcss";
@import url("/fonts/lxgw-wenkai/lxgwwenkai-regular.css");
```

> 注意：霞鹜文楷官方 CSS 有 97 个 `@font-face` 分片，**只能用 `@import` 或 `<link>` 引入**，
> 不要把它内联进 Tailwind 的 `@theme`；`@import` 一旦出现在普通规则之后会被浏览器忽略。

### 3.2 粘贴 @font-face（思源黑体 + IBM Plex Mono）

```css
/* ===== Noto Sans SC 400 ===== */
@font-face {
  font-family: "Noto Sans SC"; font-style: normal; font-weight: 400; font-display: swap;
  src: url("/fonts/noto-sans-sc/noto-sans-sc-latin-400-normal.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215;
}
@font-face {
  font-family: "Noto Sans SC"; font-style: normal; font-weight: 400; font-display: swap;
  src: url("/fonts/noto-sans-sc/noto-sans-sc-chinese-simplified-400-normal.woff2") format("woff2");
  unicode-range: U+2E80-2EFF, U+3000-303F, U+31C0-31EF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FE30-FE4F, U+FF00-FFEF, U+20000-2FA1F;
}

/* ===== Noto Sans SC 500 ===== */
@font-face {
  font-family: "Noto Sans SC"; font-style: normal; font-weight: 500; font-display: swap;
  src: url("/fonts/noto-sans-sc/noto-sans-sc-latin-500-normal.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215;
}
@font-face {
  font-family: "Noto Sans SC"; font-style: normal; font-weight: 500; font-display: swap;
  src: url("/fonts/noto-sans-sc/noto-sans-sc-chinese-simplified-500-normal.woff2") format("woff2");
  unicode-range: U+2E80-2EFF, U+3000-303F, U+31C0-31EF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FE30-FE4F, U+FF00-FFEF, U+20000-2FA1F;
}

/* ===== Noto Sans SC 700 ===== */
@font-face {
  font-family: "Noto Sans SC"; font-style: normal; font-weight: 700; font-display: swap;
  src: url("/fonts/noto-sans-sc/noto-sans-sc-latin-700-normal.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215;
}
@font-face {
  font-family: "Noto Sans SC"; font-style: normal; font-weight: 700; font-display: swap;
  src: url("/fonts/noto-sans-sc/noto-sans-sc-chinese-simplified-700-normal.woff2") format("woff2");
  unicode-range: U+2E80-2EFF, U+3000-303F, U+31C0-31EF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FE30-FE4F, U+FF00-FFEF, U+20000-2FA1F;
}

/* ===== IBM Plex Mono ===== */
@font-face {
  font-family: "IBM Plex Mono"; font-style: normal; font-weight: 400; font-display: swap;
  src: url("/fonts/ibm-plex-mono/ibm-plex-mono-latin-400-normal.woff2") format("woff2");
}
@font-face {
  font-family: "IBM Plex Mono"; font-style: normal; font-weight: 500; font-display: swap;
  src: url("/fonts/ibm-plex-mono/ibm-plex-mono-latin-500-normal.woff2") format("woff2");
}
@font-face {
  font-family: "IBM Plex Mono"; font-style: normal; font-weight: 600; font-display: swap;
  src: url("/fonts/ibm-plex-mono/ibm-plex-mono-latin-600-normal.woff2") format("woff2");
}
```

> 完整可粘贴版本（含 97 分片引用）已放在 `docs/design/tools/font-faces.css`，与上面的片段一致，
> 只把 `/fonts/` 换成了相对路径供自检；两者改动需同步。

### 3.4 如果 `@import` 被 Tailwind / PostCSS 拒绝

Tailwind v4 会在构建期处理 `@import`，个别配置下可能把根路径 URL 当成需要解析的模块而报错。
如果 `npm run dev` / `npm run build` 报 `@import` 解析失败，改用 **`<link>` 兜底**（同样由 Lead 改 `app/layout.tsx`）：

```tsx
// app/layout.tsx 的 <head> 内
<link rel="stylesheet" href="/fonts/lxgw-wenkai/lxgwwenkai-regular.css" />
```

两种方式二选一，不要同时使用；`@font-face` 部分（3.2）照常放进 `globals.css`。

### 3.3 字体变量与兜底

```css
:root {
  --font-sans: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --font-serif: "LXGW WenKai", "Kaiti SC", "KaiTi", "STKaiti", serif;
  --font-mono: "IBM Plex Mono", "JetBrains Mono", ui-monospace, "SFMono-Regular", monospace;
}

html, body {
  font-family: var(--font-sans);
}
```

把现有 `html, body { font-family: system-ui, "Segoe UI", "Microsoft YaHei", sans-serif; }` 替换为上面的写法即可。
后续组件里需要旁白/读数时直接用 `font-family: var(--font-serif)` / `var(--font-mono)`，不要在组件里写死字体名。

## 4. 自检（已跑过，可复跑）

```powershell
node docs/design/tools/render-font-check.mjs
```

2026-10-20 结果：`document.fonts` 共 **106 个 @font-face 全部 loaded**（97 文楷 + 6 黑体 + 3 等宽），
`document.fonts.check()` 对三族全部 `true`；样张落在 `docs/design/fonts-preview.png`（400/500/700 对比、文楷引文、等宽读数）。

## 5. 已知限制 / TODO

- 霞鹜文楷目前**只有 400**。若需要「引文加粗」，浏览器会合成假粗体（会糊）；建议文楷只用于正文语气，不加重。
  确需 700 时，从 `lxgw-wenkai-webfont@1.7.0` 再拉 `lxgwwenkai-bold.css` + 97 个 bold 分片（约 +4.5 MB）。
- 思源黑体只有 400/500/700，**不要用 600**（会合成），要 600 就用 500 或 700。
- 中文 woff2 单文件 1.1 MB：首次打开会有一次字体下载，已用 `font-display: swap`，不阻塞首屏；`public/fonts` 走静态资源缓存，无需预加载。
- 如果之后改用 npm 方案（`npm i @fontsource/noto-sans-sc @fontsource/ibm-plex-mono`），只需把 3.2 的 `@font-face`
  换成 `@import "@fontsource/noto-sans-sc/400.css"` 等；**当前不依赖 npm，不要为字体改 package.json**。
