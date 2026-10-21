# design-lead · 首页 / 登录页（最终版）

## 方向
- 首页：**白色主题** + 校园图轮播（8 张 henu.edu.cn 官网图），浅色封面，文字深色。
- 登录页：**暗场 lab-scene SVG 背景**（`components/portal/lab-scene.tsx`），静态不轮播，白色登录卡居中。
- 首页三张说明卡已删除，换成 3 张实验卡（01/02/09，器皿线稿 + 编号 + 实验名 + 步数）+「查看全部 10 个 →」；卡片复用 `/experiments` 的 `.cat-row` 样式。
- 单主 CTA：hero「登录开始实验」；顶栏只留「一键演示」次级入口。READY / telemetry 已删。

## 轮播
- 8 张：campus-02/03/06/01/05/04/07/08。
- `object-fit: cover; object-position: center`，**无 scale 推近**。
- 每张停留 **8200ms**；交叉淡入 **1200ms**；旧图延迟 **220ms** 后淡出；切换时两张同时可见。
- 首两张 `preload` + `loading=eager`；其余 lazy。
- `prefers-reduced-motion` 停第一张，无过渡。

## 自测（dev 3002）
- home 1440/390、login 1440/390：`scrollWidth === clientWidth`，无横向溢出。
- 轮播 8.8s 时：campus-02 opacity 0.96 / campus-03 0.38，交叉淡入成立。
- 登录输入 48px、tab 46px、按钮 50px；卡片 430/358，居中。
- tsc 0；`npm run lint` 0 error（8 个既有 warning）。
- 截图：`%TEMP%\chemlab-shots\design-lead\home-1440.png`、`home-390.png`、`login-1440.png`、`login-390.png`。

## 第二轮反馈修正（2026-10-21 12:18）
- 轮播：5000ms 停留、700ms 交叉淡入；CSS class + --slide-fade 变量，旧图/新图同时 opacity 过渡，切换中 2px blur。
- 首页：contrast(1.08) saturate(1.15)；遮罩左 0.58 / 右 0.15；不再用整层 wash 压灰。
- 登录：lab-scene 提亮 brightness(1.32)，scrim 降到约 0.32 边缘；卡片居中。
- SVG 微动效：卡内器皿 hover 液面 0.98↔1.02 / 2.4s；查看全部箭头 hover +2px；stats CountUp 260ms。
- 截图：home-1440/390、login-1440/390、carousel-1/2（间隔 5s）、home-crossfade（opacity 0.537/0.463，blur 2px）。
- tsc 0 / lint 0 error（8 个既有 warning）。
