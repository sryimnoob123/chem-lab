# chem-model notes（只追加，不改旧条目）

## 2026-10-20 18:28 · 开工
- 做了什么：读 `docs/接口契约.md` §3、`exp09` §3/§4/§6、`exp01`~`exp10` 的试剂表/现象/事故表，确定三模块字段与颜色口径。
- 证据：见任务卡 `.team/tasks/chem-model.md`。
- 改了哪些文件：无（只读）。
- 下一步：写 substances / phenomena / uncertainty + 单测。

## 2026-10-20 18:35 · 三模块 + 单测首版落盘
- 做了什么：`lib/chem/substances.ts`（约 60 种物质，含 10 实验试剂与 AgCl/AgI/BaSO4/CO₂ 等产物）、`lib/chem/phenomena.ts`（约 50 条显式现象，含 medium / excessOf / flameTest 条件消歧）、`lib/chem/uncertainty.ts`（读数位数、加减乘除、修约、误差、FAQ）。
- 证据：首轮 vitest 失败点已定位（乘法 API 缺除法、FAQ 未导出、严格 1 位按五成双为 2 而非 3）。
- 改了哪些文件：上述 3 个 + 3 个 test。
- 下一步：修测试与 API。

## 2026-10-20 18:40 · 修语法/编码事故（Lead 报的现象）
- 做了什么：`phenomena-table.ts` 出现 `Unterminated string literal` 一片报错。根因不是化学数据，而是用 PowerShell `Get-Content/Set-Content` 拆分文件时按 GBK 读写，中文串被打成乱码（也丢了个别字节）。改用 write 工具按 UTF-8 重写数据表，并把现象表按"数据/查表"拆成 `phenomena-table.ts` + `phenomena.ts`；FAQ 拆到 `sig-fig-faq.ts`，使单文件 ≤300 行。字符串内的引号统一用 ASCII 转义或全角括号表述。
- 证据：`npx tsc --noEmit 2>&1 | Select-String lib/chem` 无输出。
- 改了哪些文件：`lib/chem/phenomena-table.ts`、`lib/chem/phenomena.ts`、`lib/chem/sig-fig-faq.ts`、`lib/chem/uncertainty.ts`。
- 下一步：跑测试与全量 tsc，写交接。

## 2026-10-20 18:44 · 完成（待下游接入）
- 做了什么：三模块定稿：物质表 60+ 条（hazards/formula/storage/ref 全非空）、现象表 48 条（未命中返回 `{unknown:true, hint, suggestions}`）、有效数字模块（含"0.1 mol/L × 25.00 mL = 2.50 mmol（3 位）"的平台口径问答，严格字面版另列 2 mmol/1 位）。
- 证据：`npx vitest run lib/chem` → **3 files / 45 tests passed**；`npx tsc --noEmit | Select-String lib/chem` → **无输出**；`npx eslint lib/chem` → exit 0。
- 全项目 tsc 残留（非本轨道，未改，仅记录）：`app/exp/[id]/workbench.tsx(78,16) TS2345`；`lib/safety/incidents/exp09.test.ts` 多行 TS2339（`fxSilent`、`stepNo` 不在 `Incident` 类型上）——请 safety 轨道对齐契约 §5。
- 改了哪些文件：`lib/chem/{substances,phenomena,phenomena-table,uncertainty,sig-fig-faq}.ts` + 3 个 `*.test.ts`。
- 下一步 / 阻塞：下游（引擎/UI）按 `lookup()` 与 `recordReading()` 接入；若实验定义引用了新物质，只在 `SUBSTANCES` 补一行并按需加现象。
