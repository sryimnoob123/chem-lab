# 讲台彩排证据 · 2026-10-23

按 `docs/演示脚本-2026-10-22.md` 的段落顺序，在 1920×1080 下用真实浏览器（browser_exec，非 headless Playwright）走完整链，
连走两遍（第二遍在 dev 重启 / 冷启动之后）。

## 一、两遍的结果

| 项 | 第一遍（dev 已热） | 第二遍（dev 重启后） |
|---|---|---|
| console error / pageerror | 0 | 0 |
| 白屏 > 1s | 无（首页 FCP 1336ms 是 dev 冷编译） | 首次进 `/exp/exp01` 服务端编译 **10.6s**（dev 特性，需预热） |
| 七步 | 7/7，每步都有可见反馈 | 7/7（`实验完成`） |
| 报告总分 | 85（含 1 次 L1 −2、后测 2/3） | **86**（零事故 + 后测 3/3） |
| 教师端 | 40 / 26 / 65.0% / 84.9 / 事故 44 | 同上（seed 后保持稳定） |
| `/plan` | 主题→画布→提交评分（0 分不可行 / 8 条硬约束未过） | 同左，页面无空块 |

## 二、截图（按演示顺序）

| 文件 | 内容 |
|---|---|
| `23-pass2-home.png` | 1920×1080 首页 |
| `02-exp01-step1-done.png` / `03-exp01-step2.png` | 实验台第 1 步 / 洗完后 |
| `05-exp01-step4-done.png` … `08-exp01-step7-done.png` | 第 4–7 步 |
| `10-negative-L1-cloth.png` | 抹布擦容量瓶 → L1 −2 分 |
| `11-negative-L3-shatter-mid.png` / `12-negative-L3-shatter-end.png` / `frames/l3-*.png` | 玻璃棒戳容量瓶 → L3（碎裂帧在 640–880ms） |
| `21-L3-shards-after-fix.png` | 改 `--scene-shard` 之后同一动作 |
| `09-report.png` / `27-pass2-report-total.png` | 报告页（85 分 / 86 分两态） |
| `13-teacher-gate.png` / `13-teacher-overview.png` / `28-pass2-teacher.png` | 教师端学情总览 |
| `14-plan-topics.png` / `15-plan-canvas.png` / `18-plan-assess.png` | 拼接实验：选主题 / 画布 / 点评 |
| `20-step*-after-balance.png` | 修「点天平后底部留旧话」的前后对照 |
| `gates.log` | lint / typecheck / vitest 输出 |
| `dev-restart.log` | 第二遍前的 dev 重启日志 |

## 三、这轮改掉的两条演示瑕疵

1. **点天平后底部留一句上一步的旧话**（第 3→4 步实测）：
   仪器自己的 click 推进了步骤，同一次 click 又冒泡到舞台的「点空白」提示，用的是上一帧的建议文案（「这一步要「点天平」」），
   而场景 caption 的优先级高于「进入第 N 步」，于是整步都挂着错话。
   修法：`app/exp/[id]/scene-stage.tsx` 的舞台 onClick 里，仪器（`data-demo-id^="demo-scene-instrument"`）像器皿一样直接 return。
2. **L3 碎裂只看得到一圈暖光，看不见碎片**：
   碎片填充色 `--scene-shard: rgba(226,238,246,.96)` ≈ 纸白，在纸白台面上等于隐形；裂纹又只有一条露在闪光外。
   修法：只改 token（`app/globals.css`）→ `rgba(138,162,183,.95)`，配 `--scene-crack` 描边。

## 四、测出来但没改的（写进任务评论，留给下一轮）

- 前测角标「3/3」是**已答**数，不是答对数，和「全对解锁」并排容易被读成 3 题全对。
- 脚本化连点时「这一步没完成，再点一次」toast 会长时间停留（≥15s 未自动收）。
- dev 模式下页面上会出现英文 toast「Computing」（生产 build 待确认）。
- 侧栏 / 顶栏 / 器皿标签多为 12px，3 米外偏小（改字号属全局排版，本轮不动）。
- L3 碎裂在点击后约 0.6 秒才炸（lead 动画），讲解词要留半句。
