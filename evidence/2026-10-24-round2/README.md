# 二轮证据 · 2026-10-24（三角色审查后的修复 + /plan 视觉打磨）

- `bench-{1440,1152,1024,390}.png` —— 实验台（exp01 第 1 步），四视口
- `bench-800x700.png` —— 561~900 区间：试剂架底 420 / 台面底 429（间隔 8px，改前 74px），dock `display:none`
- `bench-exp09-1440.png` —— exp09（共用 token 的证据覆盖缺口）
- `plan-{1440,1152,1024,390}.png` —— /plan 设计区（空方案）
- `plan-*-loaded.png` —— 点「载入参考方案」后（21~28 项，planList 封顶滚动）
- `plan-*-theater.png` —— 点「危险」后的选中态（满宽描边 + 「正在演」角标）
- `plan-brief-llm.png` —— 拆解面板 `data-state="llm"`（走本地假端点，标题来自模型）
- `teacher-{1440,390}.png` —— 教师端
- `report-1440.png` —— 报告页
- `coach-auto-1440.png` / `coach-auto-closed-1440.png` —— 教师端课堂演示（`?teach=1`）引导层开/关

## /plan 布局实测（改前 → 改后，1440×900）

| 指标 | 改前 | 改后 |
|---|---|---|
| 右栏底部与左栏底部差 | 374 px（左 833 / 右 473） | **-15 px**（剧场拉到 848） |
| 「同一道题，三种结果」位置 | 首屏外（top 866） | 首屏内（top 439） |
| 三个结果按钮宽度 | 各 88 px（flex 不铺满） | 各 **239 px**（三列等分） |
| 未选态颜色 | 三枚完全一样（灰） | 绿 `rgb(15,123,108)` / 黄 `color-mix(warn)` / 红 `rgb(192,57,43)` |
| 选中态 | 1px 边 + 7% 底 | 满宽描边 + 10% 底 + 「正在演」角标 + `aria-pressed=true` |
| 素材库滚动区 | 600 px 高、内容 1331 px，组头 `static` | 组头 **sticky**，`overscroll-behavior: contain`，滚动条不再压卡片 |
| 满载 21 项时页面总高 | 2236 px | 1054 px（planList 封顶 414 px 自带滚动） |
| 参数区 | 一行只用左侧 310 px | 三列铺满（269/269/18） |

四视口均 `scrollWidth === clientWidth`，console error 0。
