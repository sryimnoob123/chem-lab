# login-motion · 登录页动效五条（task-1）

## 2026-10-21 17:20 · 完成：背景首屏描绘 + 双液滴落点涟漪 + 双层视差 + 噪点 + 逐件 hover 揭示
- 做了什么：
  - **首屏描绘**：4 件主器皿依次画出（滴定管 i=0 → 锥形瓶 i=1 → 容量瓶 i=2 → 量筒/烧杯 i=3），
    每件 outline 加 `pathLength={1}` + `.draw`（`stroke-dasharray:1; stroke-dashoffset:1→0`，1.6s
    `cubic-bezier(.23,1,.32,1)`，错峰 `calc(var(--i)*120ms)`，`forwards`，只播一次）。
    玻璃底 `.fillIn` / 细节 `.sketchIn` / 液面 `.liquid` 都排在描绘之后淡入，避免「先见液后见瓶」。
  - **循环延后**：`.scene { --loop-start: 2s }`，气泡 / 液滴 / 涟漪的 `animation-delay` 统一
    `calc(var(--loop-start) + var(--phase))`；液面呼吸与滴定管液柱用 `i*120+1.9s` 起循环。
    末件描绘结束 ≈1.96s，循环不抢戏。
  - **落点涟漪**：液滴周期改 1.8s（`cubic-bezier(.45,0,.9,.55)` 重力），双滴 `--phase` 错开 0.6s
    （第二滴 r 3 / 0.7 透明度，读作连续滴定流）；涟漪同 1.8s、同 delay 同 phase，
    keyframes `0–78% scale .35 隐藏 / 84% scale 1 @.5 / 100% scale 2.4 @0`，相位对齐液滴触液面（84%）。
    桌面落点 (254,660)（锥形瓶液面 583+116×.66≈659.6），窄屏 (94,745)、`--drip-rise:142px`。
  - **双层视差**：CSS 变量写法，`.near` ×(-6,-4)px、`.far` ×(3,2)px；监听在 page.tsx，
    只在 `(hover:hover) and (pointer:fine)` 且非 `prefers-reduced-motion` 时挂，`pointermove` 只
    `style.setProperty("--px"/"--py")`，**零 setState**，`passive:true`，卸载时移除。
  - **噪点层**：`<svg className={s.grain}>` + `feTurbulence fractalNoise baseFrequency .8 numOctaves 3
    stitchTiles=stitch` + `feColorMatrix saturate 0`（去彩点）；`opacity:.025`、`mix-blend-mode:multiply`，
    零位图零依赖。
  - **逐件 hover 揭示**：器皿组统一加 `.vessel`，父层不再整体压透明度，改为逐件
    `.far .vessel .36 → :hover .56`、`.near .vessel .62 → :hover .82`（正好 +0.2），
    `transition: opacity 200ms`，纯 CSS `:hover`（无 JS 定时器），只在
    `(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)` 下 `pointer-events:visiblePainted`。
  - **reduced-motion**：`draw` 直接 `stroke-dashoffset:0`；`fillIn/sketchIn/liquid/buretteLiquid` opacity 1；
    `.drop/.ripple` `animation:none; opacity:0`（不留悬空球）；`.far/.near` transform:none、`.vessel` transition:none。
- 证据：
  - `npx tsc --noEmit` → exit 0（无输出）
  - `npx eslint <我的 6 个文件>` → exit 0，0 error 0 warning
  - 全仓 `npm run lint` → 0 errors, 8 warnings（均为既有基线，不在本次文件里）
  - CSS module 类名交叉校验（脚本）：TSX 用到 17 个类 / CSS 定义 17 个，`MISSING: []`、`UNUSED: []`
- 改了哪些文件：
  - 改：`components/portal/login-scene.tsx`（33 行，改为根组合 + 噪点层）、
    `components/portal/login-scene.module.css`（259 行）
  - 新增（拆文件守 300 行预算）：`components/portal/login-scene-kit.tsx`（68 行，几何/颜色/Glass/变量工具）、
    `components/portal/login-scene-desk.tsx`（280 行，桌面 1440×900）、
    `components/portal/login-scene-mobile.tsx`（109 行，窄屏 390×844）
- 下一步 / 阻塞：无。截图由 Lead 出（按约束未起 dev / build）。注意全仓 lint 期间曾被别的
  轨道在写的 `lib/demo/director.ts` 短暂打断（parse error），收尾时已恢复 0 error。

## 2026-10-21 17:27 · 完成：卡片三层错峰入场 + 视差监听落 page.tsx + 拆分样式层
- 做了什么：
  - 页面内联 `<style>`（135 行）拆到 `components/portal/login-screen-styles.tsx`，`page.tsx` 只留
    `<LoginScreenStyles />`；`page.tsx` 297 → 186 行，样式层 164 行，都守住 300 行。
  - 错峰时间轴：蒙版 `.login-screen__veil` 0ms（200ms 淡入）→ 卡片 `.login-card` 60ms（280ms，
    `translateY(12px) scale(.96)`，绝不 scale 0）→ 品牌行 120ms / tabs 180ms / form 240ms（各 180ms）
    → 页脚 300ms（120ms）。最晚 420ms 结束。
  - 视差监听写在 `app/login/page.tsx`，`useRef` 挂 `.login-screen`（不用 querySelector），
    两个 media query 都过才挂 `pointermove`。
  - 顺手接音效（Lead 追加）：`import { playSound } from "@/lib/audio/engine"`；
    提交成功 `router.push` 前 `playSound("ok-l1")`；`!res.ok` 与 `catch` 分支 `playSound("error-system")`；
    tab 切换 `playSound("tick")`。全部在点击/提交回调链里，模块顶层无 AudioContext。
- 证据：`npx tsc --noEmit` exit 0；`npx eslint`（我的 6 个文件）exit 0；全仓 `npm run lint` 0 error / 8 warning。
- 改了哪些文件：`app/login/page.tsx`（186 行）、新增 `components/portal/login-screen-styles.tsx`
- 下一步 / 阻塞：无；音效优先级低，若 Lead 认为登录页不该有 tick，删 3 行即可。

## 2026-10-21 17:38 · 完成：a11y 触控区 ≥44px（brand 链接 + 返回门户）
- 做了什么：`login-screen-styles.tsx` 里给
  `.login-card .login__brand` 加 `min-height:44px; padding:6px 0`；
  新增 `.login-card .login__foot a { display:inline-flex; align-items:center; min-height:44px; padding:0 2px }`。
  只加垂直留白，字重/字号/颜色不变，卡片视觉重量不变。
- 证据：`node scripts/motion-audit.mjs /login` → 「触控区 ≥44px — 8 个可点元素」PASS。
- 改了哪些文件：`components/portal/login-screen-styles.tsx`（+16 行，共 182 行）
- 下一步 / 阻塞：无。

## 2026-10-21 17:42 · 完成：循环动画预算收口 + motion-audit 全 PASS（10/10）
- 背景裁定：Lead 撤回「换校园图」指令，登录页保持器皿方案（已确认未开始改图，无需回退）。
- 做了什么（为满足 `循环动画 ≤6` 预算，只砍最不易察觉的 4 个循环元素）：
  - 删 `login-scene-desk.tsx` 远景烧杯里的 2 个气泡（`.36` 透明度下几乎不可见，近景锥形瓶 2 个气泡保留）；
  - 删 `login-scene-mobile.tsx` 窄屏的悬空液滴 + 涟漪（窄屏本来没有滴定管，液滴从画面外飘入略跳；窄屏保留液面呼吸）。
  - 桌面双液滴 + 双涟漪 + 锥形瓶气泡全部保留（3 组：bubble / drip / ripple，元素数 6）。
- 证据：`node scripts/motion-audit.mjs /login`（BASE_URL=http://localhost:3002）：
  `合计 10 项，失败 0 项`，10/10 PASS — 列：
  无横向溢出 0px / SVG 节点 153(≤400) / 循环动画 6 元素 3 组 / 首屏描绘 8 个 draw 元素 /
  --px 写入 / 视差 near5.0px far2.5px(≤10) / 无 pageerror / 减动效 running=0 / 移动端无横向溢出 / 触控区 8 个可点元素。
  `npx tsc --noEmit` exit 0；`npx eslint <本次文件>` exit 0。
- 注意（给 Lead）：`scripts/motion-audit.mjs` 里 `infiniteGroups`（第 60 行）算出来但没被返回/使用，
  第 76 行判据仍是 `m.infiniteCount`（元素数）。我按元素口径收到 6，两种口径现在都能过；
  若你确实要改成组口径，把第 66 行返回加 `infiniteGroups`、第 76 行换掉即可（该文件不属我写作用域，未动）。
- 改了哪些文件：`components/portal/login-scene-desk.tsx`（269 行）、`components/portal/login-scene-mobile.tsx`（84 行）
- 下一步 / 阻塞：无。
