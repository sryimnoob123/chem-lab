# portal-bg · 门户首页背景（task-8）

## 2026-10-21 17:58 · 完成：门户背景减淡 + 只留强相关校园图 + 缓慢 Ken Burns
- 做了什么：
  - `components/portal/campus-slides.tsx`：8 张→7 张（**删 campus-08 党建宣传图**）；顺序 **06 明伦校区南大门（「河南大學」匾额）第一** → 02 庆西学舍 → 03 龙子湖航拍 → 05 校园组图 → 01 秋韵 → 07 校庆 114 周年 → 04 口号海报；每张给桌面/移动两套 `object-position`（桌面把主体推离左侧压条，移动端水平居中保匾额）；当前图 **26s Ken Burns scale(1→1.04)**，只动 transform，无第二层动效；reduced-motion 下无动画无缩放。
  - paper 遮罩减淡：`0.58/0.55/0.42/0.20/0.15` → `0.34/0.30/0.17/0.07/0.03`；底部白雾 22%→15%。
  - `app/page.tsx`：`cover__wash` 底部白雾 26%→11%；`cover-hero::before` 文字压条右扩到 150px、85% 处仍 0.8 → 94% 0.42 → 100% 0（右侧校园图保持清晰）；移动端竖向 0.4→0.68 且 secondary 文字加深 `#2e3a48`；slogan 由 `rgba(74,87,104,.78)` 改 `--ink-2`。
  - `app/styles/cover-light.css`：去掉 `.cover__scene` 的 invert/hue-rotate 换色滤镜（本就被 inline `filter:none` 覆盖）与 9s 浮动动画（避免与 Ken Burns 叠两层）；移动端 scene `opacity .26→1`。
- 证据：
  - **对比度实测**（Playwright 逐张轮播取 7 张最差值；worse-of-pixels，WCAG 相对亮度；脚本 `%TEMP%\chemlab-shots\portal-bg\measure-portal-bg.mjs`）：
    - 1440×900：标题 **10.95** / 副标题 **5.71** / slogan **5.24** / 实验名 **11.4** / 实验说明 **4.94** / 查看全部 **5.92** / CTA **11.66**
    - 390×844：标题 **6.66** / 副标题 **5.16** / slogan **5.46** / 实验名 **8.08** / 实验说明 **5.92** / 查看全部 **6.96** / CTA **11.66**
    - 全部 ≥4.5（改前 slogan 2.95、实验说明 4.13 是不达标的）
  - 截图：`%TEMP%\chemlab-shots\portal-bg\`（`before-*`、`after-*-slide1..7.png`、`compare-1440x900.png`、`compare-390x844.png`、`after-reduced-motion-1440x900.png`、`final-measure.json`、`scene-only-mobile.png`）
  - 行为验证：轮播 7 张 / 首图 campus-06 / 无 campus-08；`data-demo-id` 7 个一个不少；CTA 仍 (101,277,154,50) 且点击跳 `/login`；390 无横向溢出（390=390）；reduce 模式 6.2s 后仍第 1 张、animation none、transform none；active 图 `campus-kenburns 26s`。
  - `npm run lint`：**0 error**（8 条既有 warning，均不在本次文件）。
  - `npx tsc --noEmit`：唯一报错 `app/exp/[id]/scene-stage.tsx(83,62)`（`line` vs 需要 `lines`），是该文件未提交改动（workbench/flow 轨）引入，**不在本次 3 个文件**；等其修复后应回空。
- 改了哪些文件：`app/page.tsx`、`components/portal/campus-slides.tsx`、`app/styles/cover-light.css`（`cover.css` 未改）
- 下一步 / 阻塞：
  - 等 scene-stage 轨道修好后复跑一次 `npx tsc --noEmit`（届时应为空）。
  - `cover-light.css` 334 行（改前 346）：>300 属存量情况，本次只减不增。
  - 移动端匾额完整入画（见 `scene-only-mobile.png`），但白雾后仍以"透出来"为主；若用户要移动端更显眼，可把 `.cover-hero::before` 竖向压条再降 0.05（对比度还有 5.16 余量）。
