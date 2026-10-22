# /plan 拼接式方案：先评分、后校验 + 素材按实验阶段分组（2026-10-22 晚）

## 做了什么
1. **先评分、后校验**：`/plan` 顶部改成评分卡 —— 39px 总分 + 一句话结论（可行/不可行 + 得分），
   下面两栏「哪里对」（已满足规则的短名 chip）/「哪里不对」（最多 3 条，硬约束优先，带改法）。
   逐条问题收进原生 `<details>`「展开校验明细」，**默认收起**，展开/收起由 `open` 属性驱动，
   文案与箭头旋转走 CSS（`[open]` 选择器），不额外加 state。
2. **素材按实验阶段分组出题**：`lib/plan/pieces.ts` 新增 `PLAN_GROUPS` 一份 id 映射（不动 PIECES 结构），
   分 ① HCl 标定 15 块 / ② 总碱度测定 7 块 / ③ 通用器材与记录 10 块 = 32 块全覆盖、无重复。
   每组标题 + `已选 n / 总 m`；kind（器材/试剂/步骤/参数）退化为筛选 chip，默认「全部」。
3. 保留：点击加入/取消、上下移动、删除、参数输入（dryTemp / parallelCount / hood）、保存方案、
   全部 `data-demo-id`（score / reference / save / piece-* / tab-* / issues / piece-count / param-*）。
   颜色全走 token（`--paper/--ink/--line/--river-700/--jade-600/--danger/--warn` + color-mix），
   动效只做 transform（chip hover / 按下 scale(.97) / 箭头 rotate 180ms），带 prefers-reduced-motion。

## 新增 DOM 契约（演示脚本 / e2e 可加断言）
- `[data-demo-id="demo-design-score"]`：`"88 / 100"`（含得分，旧脚本 `/100/` 正则仍成立）
- `[data-demo-id="demo-design-top-issues"] li`：「哪里不对」预览（≤3 条）
- `[data-demo-id="demo-design-issues"]`：`<details>`，`open=false` 默认收起；其下 `li` = 全部问题
- `[data-demo-id="demo-design-group-standardization|alkalinity|general"]`：三个分组容器，标题为 h3
- `[data-demo-id="demo-design-passed"] li`：已满足规则短名

## 证据
- `./node_modules/.bin/tsc --noEmit` → exit 0，0 错
- `./node_modules/.bin/eslint app/plan lib/plan` → exit 0，0 error
- `curl -s -o <file> -w '%{http_code}' http://127.0.0.1:3000/plan` → `HTTP 200 · 35586 bytes`
  （`-o /dev/null` 在本机 bash+rtk 下 exit 23 写空设备失败，码值仍是 200）
- `./node_modules/.bin/vitest run lib/plan` → 4 files / 111 tests passed（新增 `lib/plan/groups.test.ts` 覆盖分组全覆盖、过滤、结论文案、21 条规则短名）
- 浏览器实测（390×844 与 1258×566）：空方案 0 分/13 条问题但明细收起；载入参考方案 100 分、21 条全过；
  去掉 Na₂CO₃ → 88 分「不可行 · 1 条硬约束没过」，明细展开可读；保存 → `已保存方案 56b2ac72…`；
  `scrollWidth === clientWidth === 390`（无横向溢出），chip/按钮/明细行高均 ≥44px

## 改了哪些文件
- 改：`app/plan/designer.tsx`（333→237 行，拆出两个组件）、`lib/plan/pieces.ts`（+PLAN_GROUPS，302 行内）
- 新：`app/plan/score-panel.tsx`、`app/plan/piece-library.tsx`、`app/plan/plan.module.css`、
  `lib/plan/groups.ts`、`lib/plan/verdict.ts`、`lib/plan/rule-labels.ts`、`lib/plan/groups.test.ts`

## 下一步 / 未做
- `scripts/plan-teacher-check.mjs` 未实跑：本机 playwright 缺 chromium 二进制（不许 npm install），
  但脚本用到的 tab-* / piece-* / issues li / score 元素已在浏览器里逐个验过。
- 移动端「哪里对」chip 会有 6~8 行，评分卡把素材库推到首屏下面（用户口径要求评分在最前，未改）。
