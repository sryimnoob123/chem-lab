# 动效专项：Slides/Motion 过渡（非首页/登录页）

认领人：pedagogy-engine
独占文件：`app/globals.css`、`components/motion/*`、`app/experiments/page.tsx`、`app/exp/[id]/{page,workbench,report/page}.tsx`、`components/exp/bopbps-gate.tsx`

## 目标
1. `/experiments`：卡片错峰淡入（Reveal 40ms 步长）、标题/分组头轻 enter、整页 260ms 进入。
2. `/exp/[id]`：前测卡 180ms 退场 → 操作台 260ms 淡入；锁定页也带 page-enter。
3. `/exp/[id]/report`：后测卡/总分/三段分/双面板/时间线 6 段 0~200ms 错峰 Reveal。
4. 通用 page 进入 260ms；视口内区块用 `Reveal`。
5. 只动 transform/opacity、单过渡 ≤300ms、按下 0.97、reduced-motion 全瞬时。

## 对外接口
- CSS：`.ix-page-enter` / `.ix-fade-in` / `.ix-leave` / `.ix-reveal[data-reveal]` / `.cat-row__link.ix-lift`
- `<Reveal index as className data-* aria-* style>`；`.ix-reveal` 由组件自动加，覆盖 portal.css 旧 640ms。

## 验收
- 命令：`npx tsc --noEmit` → 0 输出；`npm run lint` → 0 error。
- 截图：`%TEMP%\chemlab-shots\pedagogy-motion\*.png`（1440×900 / 390×844），无横向溢出。
- 计算样式抽查：reveal=opacity,transform 0.26s；card=transform,opacity 0.08s；reduced-motion=none。
