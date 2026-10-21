# handoff · login-motion（登录页：器皿动效 + a11y + 审计全绿）

## 文件分工（验收按这个看）
| 文件 | 行 | 负责 |
|---|---|---|
| `components/portal/login-scene.tsx` | 33 | 根组合：`.scene` + DeskScene + MobileScene + 噪点层 |
| `components/portal/login-scene-kit.tsx` | 68 | 共享画法：器皿 path 常量/试剂色/`Glass`/`--i` 工具 |
| `components/portal/login-scene-desk.tsx` | 269 | 桌面 1440×900：远景 4 件（无气泡）+ 近景 6 件 |
| `components/portal/login-scene-mobile.tsx` | 84 | 窄屏 390×844（无液滴/涟漪，保留液面呼吸） |
| `components/portal/login-scene.module.css` | 259 | 全部背景动效 keyframes + 视差 + hover + reduced-motion |
| `components/portal/login-screen-styles.tsx` | 182 | 页面骨架样式 + 卡片三层错峰 + a11y 44px 触控规则 |
| `app/login/page.tsx` | 186 | 卡片/表单/视差监听/音效调用 |

## 本轮结论
- 背景**保持器皿方案**（Lead 已撤回换校园图指令，未开始改图，无需回退）。
- a11y：`.login__brand` min-height 44 + padding 6px 0；`.login__foot a` inline-flex + min-height 44（只加留白，视觉不变）。
- 循环预算：删远景烧杯 2 个气泡 + 窄屏悬空液滴/涟漪（共 4 个最弱元素），桌面双液滴/双涟漪/锥形瓶气泡全保留 → 元素 6、组 3。
- `motion-audit /login` = **10/10 PASS**（循环 6、draw 8、视差 near 5.0/far 2.5px、触控 8 个 ≥44、减动效 running 0）。
- 注意：`scripts/motion-audit.mjs:60` 算了 `infiniteGroups` 但 `:76` 仍用元素数 `infiniteCount`（该文件不属我作用域，未改）；现两种口径都能过。
- `npx tsc --noEmit` = 0；`npx eslint <我的文件>` = 0。
- 未起 dev/build（用 Lead 的 3002 只读页面自测）；截图为空（Lead 说不用）。