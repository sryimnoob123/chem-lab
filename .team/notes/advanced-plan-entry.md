# 进阶学习入口解锁（2026-10-22 演示前）

## 做了什么
- 实验列表页新增「进阶学习 / 拼接实验（拼接式方案）」行（`data-demo-id="demo-advanced-plan"`），
  解锁时是指向 `/plan` 的 `<Link>`，未解锁时是 `aria-disabled` 的 `<div>`，徽章文案「做完 1 个实验后解锁」。
- 新增只读查询 `lib/queries/plan-access.ts: hasFinishedRun(studentNo)`：`runs` 表存在
  `student_no=学号 AND status='finished'` 即 true；任何异常 catch → false（不 500）。
- `?unlock=all`（调试开关）同时放开该入口。

## 证据
- `tsc --noEmit` 0 错；`eslint app/experiments app/plan lib/queries/plan-access.ts` 0 error 0 warning。
- `/experiments` 200（20250101 → 徽章「可进入」，href="/plan"）；新学号 99990001 → 文案「做完 1 个实验后解锁」、
  无 href、`data-state="locked"`；`/plan` 200。
- 浏览器实跑 /plan：载入参考方案 → 28 项 / 100 分可行 → 保存方案 → 「已保存方案 <uuid>」。
- 截图：进阶入口在「重点实验」与「更多实验」之间，绿色左边框 + ◆ + 「可进入」。

## 遗留（不在本任务写作用域）
- `components/app/shell.tsx` 第 83-85 行侧边栏仍是「进阶学习 · 即将开放」死条目，与本入口不一致，需主 agent 统一。
- 验证时用学号 99990001 往 `plans` 表写过一条探测记录（教师端查询不读 plans，不可见）。
