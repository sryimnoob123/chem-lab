# handoff · sound-engine（音效引擎，task-5）
## 接线接口
```ts
import { playSound, setMuted, toggleMuted, isMuted } from "@/lib/audio/engine";  // 永不抛错
playSound(id: SoundId, opts?: { delayMs?: number }): void
import { SoundToggle } from "@/components/audio/sound-toggle";
<SoundToggle className? labelOn? labelOff? />  // 默认开启，静音记忆 localStorage
```
- 在用户交互链路调用 `playSound`（点击/拖拽/键盘）：首次调用才创建 AudioContext；静音键 localStorage `chem-lab:sound-muted`（`1`=静音），组件自带 `aria-pressed`。
## 8 个 kind（`SoundId`）用途
- `ok-l1` 单个动作判对（L1 微反馈，最轻最快 ~98ms）；`ok-l2` 一步完成 / stepIndex 前进（L2）
- `ok-l3` 交卷 / 报告生成 / 出分 / 满分（L3，最长 177ms）；`fail-reject` E1 拒收（投错目标、顺序错、无效位置）
- `fail-incident` E2 事故 L3/L4（低频+噪声包络，380ms）；`error-system` E3 系统错误（网络/5xx/登录失败，下行两音）
- `tick` 读数变化 / 悬停刻度（极轻，可高频）；`drop` 滴定液滴落定 / 加液完成
## 边界与证据
音效表 `lib/audio/kinds.ts`；峰值 = 0.08 × spec.gain ≤ 0.08（≈ -22 dB）；不循环、无 BGM、零素材零依赖。
tsc 0 / lint 0 error / vitest 27 files 444 passed（新增 28）。
