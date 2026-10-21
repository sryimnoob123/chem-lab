# 登录页 / 首页 背景动效 —— 接手教学文档

> 写给**下一个对话**：读完这一份就能直接改，不用翻聊天记录。
> 作者：design-lead · 最后更新 2026-10-21
> 调研背景见 `docs/design/MOTION-RESEARCH.md`；手感参数总表见 `docs/design/MOTION.md`。

---

## 0. 30 秒上手

```powershell
# 1. 本地库（每个 checkout 只能一个 dev server 在跑）
$env:PGLITE_DIR=".pgdata-dev20"
npx next dev -p 3002

# 2. 看页面
#   http://localhost:3002/login      ← 本文档主要讲这个
#   http://localhost:3002/           ← 首页
#   http://localhost:3002/scene-preview ← 实验页器皿画法的"母版"
#   http://localhost:3002/exp/exp01?force=1 ← 真实操作台

# 3. 每次改完必跑
npx tsc --noEmit
npm run lint
```

> ⚠️ `3001` 是 Lead 的生产构建，**不要重启、不要 `npm run build`**。
> ⚠️ Next 16 一个 checkout 只允许一个 dev server；端口被占时 Next 会自己报替代端口，用那个。

---

## 1. 涉及的三个文件（就这三个，别扩散）

| 文件 | 职责 | 行数预算 |
|---|---|---|
| `components/portal/login-scene.tsx` | 背景 SVG：器皿几何 + 液体色 + 动效钩子（className） | ≤300 |
| `components/portal/login-scene.module.css` | 背景各层透明度 + keyframes + reduced-motion | ≤180 |
| `app/login/page.tsx` | 页面骨架、登录卡、内联 `<style>`（卡片/表单/按钮动效） | ≤300 |

**不许动**：`app/page.tsx`、`app/globals.css`、`components/exp/**`、`app/teacher/**`、`package.json`。

---

## 2. 视觉语言契约（这是被否过两次才定下来的）

### 2.1 唯一真源：`components/exp/scene/vessel-art.tsx`

登录页背景的器皿**必须**和实验操作台长得一模一样。规则就四条：

| 项 | 值 |
|---|---|
| 描边 | `#16202C`，`stroke-opacity 0.7`，`stroke-width 1.4` |
| 玻璃填充 | `#fff`，`fill-opacity 0.5` |
| 高光 | 左上一条 2px 白线，`stroke-opacity 0.35` |
| 液体 | 真实试剂色，`fill-opacity 0.42~0.52` |

禁止：渐变、投影、模糊、发光、多层叠加。**像科学插图，不像 App 图标。**

### 2.2 几何直接抄

`login-scene.tsx` 顶部已经把这几个常量逐字搬过来了，**改之前先确认和 `vessel-art.tsx` 仍然一致**：

```ts
const FLASK_BODY      = "M63 16 H97 V62 L128 178 Q128 184 122 184 H38 Q32 184 32 178 L63 62 Z";
const BEAKER_BODY     = "M26 41 V188 H134 V41 Z";
const VOLUMETRIC_BODY = "M68 18 H92 V70 C92 80 128 102 132 134 Q136 162 116 176 Q98 188 80 188 Q62 188 44 176 Q24 162 28 134 C32 102 68 80 68 70 Z";

const FLASK_LIQUID      = "M31.0 116 H129.0 L126 178 Q128 184 122 184 H38 Q32 184 34 178 Z";
const BEAKER_LIQUID     = "M29 114 H131 V186 H29 Z";
const VOLUMETRIC_LIQUID = "M36 140 H124 Q128 160 112 174 Q96 188 80 188 Q64 188 48 174 Q32 160 36 140 Z";
```

局部坐标系：锥形瓶/烧杯 160×200，容量瓶 160×200，滴定管 120×360。外层用 `<g transform="translate(x y) scale(s)">` 定位，**不要改 path 本身**。

### 2.3 液体色：取真实试剂

| 器皿 | 试剂 | 色值 | 来源 |
|---|---|---|---|
| 锥形瓶 | 酚酞 + NaOH（滴定终点） | `#F48FB1` | `lib/chem/substances.ts` `COLORS.pink` |
| 容量瓶 | KMnO₄ 稀释 | `#B39DDB` | 紫色系（`COLORS.purple #6A1B9A` 提亮） |
| 烧杯 | CuSO₄ 0.1 mol/L | `#81D4FA` | `COLORS.lightBlue` |
| 滴定管 / 量筒 | 标准溶液 / 蒸馏水 | `#DCE9F2` | `WATER_TINT` |

**全页只能有一个强调色。**当前是酚酞粉，其余都是冷色。加第二个暖色会立刻"土"。

### 2.4 构图：两层景深 + 一条基线

- 桌面 `viewBox="0 0 1440 900"`，`preserveAspectRatio="xMidYMid slice"`。
- **台面线** `y = 704`，所有器皿底边必须落在线上（近景线 `x 40→520`，远景线 `x 960→1440`）。
- 近景 `.near` `opacity 0.62`（铁架台 + 滴定管 + 锥形瓶 + 称量瓶 + 坩埚 + 洗瓶）
- 远景 `.far` `opacity 0.36`（容量瓶 + 量筒 + 烧杯 + 漏斗）
- 中间 x 505~935、y 220~680 是登录卡领地，**别放东西**。
- 窄屏 `viewBox="0 0 390 844"`，另一套排布，`@media (max-width:720px)` 切换 `.desk` / `.mobi`。

---

## 3. 动效规范（照做，别自创）

### 3.1 硬规则

1. **只动 `transform` / `opacity`**（以及 `filter`、`clip-path`）。禁止 `width/height/top/left/background-color` 做位移动画。
2. **两个时间尺度**：
   - 交互反馈（按钮、输入框、tab）**≤ 300ms**
   - 环境动画（液面、气泡、描绘）**2.4s ~ 12s**，无限循环
   中间地带（400ms~2s 的循环）最难看，避免。
3. **缓动**：
   - 进入/位移 `cubic-bezier(.23,1,.32,1)`（ease-out-quint）
   - 重力/下落 `cubic-bezier(.45,0,.9,.55)`（ease-in，越掉越快）
   - 弹性回弹 `cubic-bezier(.34,1.56,.64,1)`
   - 环境循环用 `ease-in-out` 或 `linear`
4. **`prefers-reduced-motion: reduce` 必须全关**，并保留静态信息（液滴 `opacity:0`，不要留一个悬在空中的球）。
5. 背景 SVG 一律 `aria-hidden="true"` + `pointer-events: none`。

### 3.2 当前的动效清单（`login-scene.module.css`）

| 类 | 动效 | 时长 / 缓动 |
|---|---|---|
| `.liquidSway` | 锥形瓶液面 `scaleY .99↔1.012`，`transform-origin: center bottom` | 3.5s ease-in-out |
| `.buretteLiquid` | 滴定管液柱极缓下降 `scaleY 1↔.97` | 12s ease-in-out |
| `.drop` / `.dropSm` | 粉色液滴 `translateY 0 → var(--drip-rise)`，落点消失 | 2.4s `cubic-bezier(.45,0,.9,.55)` |
| `.bubble` | 气泡上浮 `translateY -62px` | 8s linear |
| 卡片入场 | `translateY(12px) scale(.96)` → 1 | 280ms `.23,1,.32,1` |
| tab 指示条 | `translateX` 0 → 186px | 160ms |
| 输入框 focus | 边框 + `0 0 0 3px rgba(35,48,127,.12)` | 160ms |

> 液滴落点距离用 CSS 变量控制：`style={{ "--drip-rise": "46px" }}`，桌面 46px、窄屏自己算。

---

## 4. 可复制的代码模式（下一版要加的）

### 4.1 线稿「描绘」入场（首帧只播一次）

给每个要描绘的 `path` 加 `pathLength={1}`，CSS 里：

```css
.draw {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw 1.6s cubic-bezier(.23,1,.32,1) forwards;
}
@keyframes draw {
  to { stroke-dashoffset: 0; }
}
```

错峰：`style={{ animationDelay: `${i * 120}ms` }}`。
⚠️ `pathLength={1}` 让不同长度的 path 用同一套数值，省得算 `getTotalLength()`。

### 4.2 落点涟漪（签名瞬间）

```tsx
<circle className={s.ripple} cx={254} cy={594} r={4} fill="none" stroke={PINK} strokeWidth={1.6} />
```

```css
.ripple {
  transform-box: fill-box;
  transform-origin: center;
  animation: ripple 2.4s cubic-bezier(.23,1,.32,1) infinite;
  /* 与 .drop 同周期，滴落后 200ms 起 */
  animation-delay: 0.34s;
}
@keyframes ripple {
  0%, 14% { transform: scale(.4); opacity: 0; }
  22%     { transform: scale(1);  opacity: .45; }
  60%     { transform: scale(2.4); opacity: 0; }
  100%    { transform: scale(2.4); opacity: 0; }
}
```

关键：**和液滴同周期**（都 2.4s），涟漪相位 = 液滴落到液面的那一刻。不同步就会显得随机。

### 4.3 指针视差（两层不同速度）

```tsx
// app/login/page.tsx 里，mousemove 只写 CSS 变量，不 setState
useEffect(() => {
  const el = document.querySelector<HTMLElement>(".login-screen");
  if (!el) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  const onMove = (e: PointerEvent) => {
    const x = (e.clientX / innerWidth - 0.5) * 2;
    const y = (e.clientY / innerHeight - 0.5) * 2;
    el.style.setProperty("--px", String(x));
    el.style.setProperty("--py", String(y));
  };
  addEventListener("pointermove", onMove, { passive: true });
  return () => removeEventListener("pointermove", onMove);
}, []);
```

```css
.near { transform: translate3d(calc(var(--px, 0) * -6px), calc(var(--py, 0) * -4px), 0); }
.far  { transform: translate3d(calc(var(--px, 0) *  3px), calc(var(--py, 0) *  2px), 0); }
```

幅度 ≤10px，否则晕。`prefers-reduced-motion` 下直接不挂监听。

### 4.4 噪点层（去数字平涂感）

```tsx
<svg className={s.grain} aria-hidden="true">
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" /></filter>
  <rect width="100%" height="100%" filter="url(#grain)" />
</svg>
```

```css
.grain {
  position: absolute; inset: 0; opacity: .025;
  mix-blend-mode: multiply; pointer-events: none;
}
```

### 4.5 卡片多层错峰入场

三层：`蒙版 (0ms) → 卡片 (60ms) → 内部三行 (120/180/240ms)`，都用 `translateY` + `opacity`，总时长仍 ≤ 420ms。

---

## 5. 验收清单（每次交付都要过）

- [ ] `npx tsc --noEmit` → 0
- [ ] `npm run lint` → 0 error（当前基线 9 条 warning，都不在这三个文件里）
- [ ] 1440×900 截图：`scrollWidth === clientWidth`
- [ ] 390×844 截图：同上；输入框 48px；触控区 ≥44px
- [ ] `prefers-reduced-motion: reduce` 下：`animationName === "none"`、液滴 `opacity: 0`
- [ ] 背景器皿与 `/scene-preview` 并排看，质感和线宽必须一致
- [ ] 截图落到 `%TEMP%\chemlab-shots\design-lead\`

截图脚本（ego lite，唯一允许的浏览器）：

```js
const task = await taskSpace("chemlab-login-<日期>-<时分>");
const p = task.page("p1");
await p.cdp("Browser.setWindowBounds", {
  windowId: (await p.cdp("Browser.getWindowForTarget", {})).windowId,
  bounds: { windowState: "normal", left: 0, top: 0, width: 1460, height: 1000 },
});
await p.cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await p.goto("http://localhost:3002/login");
await new Promise((r) => setTimeout(r, 1800));
await p.screenshot({ path: "C:/Users/14681/AppData/Local/Temp/chemlab-shots/design-lead/login-1440.png" });
```

reduced-motion：`p.cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] })` 后 `p.reload()`。

---

## 6. 已知坑

| 坑 | 现象 | 解 |
|---|---|---|
| ego 窗口最小化 | `Cannot capture a screenshot while the window is minimized` | 先 `Browser.setWindowBounds` 置 `windowState: "normal"` |
| `p.setViewportSize` 不存在 | TypeError | 用 `Emulation.setDeviceMetricsOverride` + `reload()` |
| 第二个 dev server | `Another next dev server is already running` | 一个 checkout 只跑一个，用 Next 报的端口 |
| PGlite `RuntimeError: Aborted()` | `/dev` 500 | 换新的 `.pgdata-devNN` + `npm run db:init` + `npm run db:demo` |
| SVG `scale` 后描边变粗 | 线条糊 | 器皿外层放大时同步下调 `strokeWidth`（本项目用 `1.4 / scale` 手算） |
| `transform-box` 没设 | SVG 元素 `scale` 绕 (0,0) 跳 | 动 SVG 元素必须写 `transform-box: fill-box` + `transform-origin` |

---

## 7. 还没做的（下一版优先级）

1. **首帧描绘**（4.1）——器皿依次画出，只播一次。
2. **落点涟漪**（4.2）——让「滴定」成为签名瞬间。
3. **指针视差**（4.3）。
4. **噪点层**（4.4）。
5. 背景 hover 揭示：鼠标掠过某件器皿 → 该件 `opacity` 0.62 → 0.9，200ms。
6. 首页同步做一遍（首页目前只有校园轮播，动效更少）。

---

## 8. 用户偏好（血泪版）

- 不要解释性小字 / 不要微文案堆砌。
- 配色只有白 + 河大蓝 `#23307F`，加一个试剂色。
- 「有设计感」= **材质 + 一个被记住的瞬间**，不是"元素更多"。
- 每件器具必须能在本课程 10 个实验里找到出处，不要画用不上的东西。
- 交付带 **URL + 「点哪、预期什么」清单 + 截图路径**，没有证据视为没做。
