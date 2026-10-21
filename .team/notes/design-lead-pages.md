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

## 第三轮（用户对线上版三条反馈）
### 1. 首页 H1 教育属性
- H1 = `无机及分析化学实验`（原「把每一次读数…」降级为 12px 灰 slogan，在 H1 下一行）。
- 副标题：`河南大学 · 化学化工学院 · 03600004 · 36 学时 · 10 个实验`。
- 顶栏副标题改「化学化工学院」；页脚也改「化学化工学院」。

### 2. 三张大卡 → 简明实验清单（新文件 components/portal/experiment-list.tsx）
- 5 条：01 / 02 / 08 / 09 / 10；每条「编号 + 实验名 + 一句特点」。
- 桌面 2 列、≤720px 单列；行高 46px（移动 44px），无卡片阴影无缩略图。
- 列表块高度：1440 时 160px（原三卡约 250px+），390 时 260px。
- 底部「查看全部 10 个实验 →」，箭头 hover +2px。

### 3. 登录页 白蓝 + 动效
- 去暗场 lab-scene，改：浅蓝底 #f3f6fb + 72px 蓝网格 + 双径向光晕；校园图 campus-02 作 16% 淡背景 + 白色蒙版。
- 三个器皿线稿（容量瓶/滴定管/烧杯）14% 蓝、21~30s 缓慢漂浮。
- 卡片入场 280ms `cubic-bezier(.23,1,.32,1)`，从 `translateY(12px) scale(.96)`。
- tab 指示条独立元素 160ms `translateX(0→100%)` 滑动（实测 matrix 0→186）。
- 输入框 focus：边框 → river-700 + 3px 12% 蓝光圈，160ms。
- 按钮 hover scale(1.01)（仅 hover 设备）、按下 scale(.97)。
- reduced-motion 全关。

### 证据
- home-1440 / home-390 / login-1440 / login-390 均 `scrollWidth === clientWidth`。
- tsc 0；lint 0 error（8 个既有 warning）。
