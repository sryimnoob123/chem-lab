# handoff · positive-feedback（正反馈组件库）

落盘 `components/exp/feedback/`：0 依赖、0 新包、全 `"use client"`。
tsc --noEmit=0；npm run lint=0 error（既有 9 warning 与本次无关）。

```ts
// index.ts 导出：SuccessBurst / ScoreOdometer / StreakPill / EndingFlash / useReducedMotion
SuccessBurst({ level?: "L1"|"L2"|"L3"; size?: number; segments?: number; replayKey?: string|number; demoId?: string; className?: string })
ScoreOdometer({ value: number; from?: number; duration?: number; suffix?: string; decimals?: number; label?: string; demoId?: string; className?: string })
StreakPill({ count: number; label?: string; demoId?: string; className?: string })  // count<2 不渲染
EndingFlash({ tone?: "ok"|"endpoint"; children: ReactNode; demoId?: string; className?: string })
useReducedMotion(): boolean
```

- L1：器皿外层 `SuccessBurst level="L1" replayKey={事件计数}`（absolute 容器内居中，size≈器皿×1.2）。
- L2：`SuccessBurst level="L2" replayKey={stepIndex}`；现象变色用 `EndingFlash tone="ok"` 包器皿。
- L3：`ScoreOdometer value={score} suffix="分" label="总分"`；滴定终点 `EndingFlash tone="endpoint"`。
- `StreakPill` 只在 ≥2 连对时给，0/1 别占位；EndingFlash 只播一次，重播请换 `key` 重挂。
- 减动效已内建降级（静态刻度环 / 终值 / accent 描边），无需额外代码；颜色不适配用 `className` 覆盖。
- 全程只动 transform/opacity/filter，时长走 `--pulse/--pop/--tint`，无循环。
