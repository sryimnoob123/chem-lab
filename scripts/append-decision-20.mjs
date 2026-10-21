import fs from "node:fs";

const file = ".team/DECISIONS.md";
const cur = fs.readFileSync(file, "utf8");
if (cur.includes("## 20.")) {
  console.log("§20 已存在");
  process.exit(0);
}

const lines = [
  "",
  "## 20. 撤销 §19：做全优先于精简（2026-10-21 01:10）",
  "",
  "用户修正：功能尽量做全，别砍；多套交互方案能做就做，优先保证每一套都能跑通。",
  "优先级顺序：**不崩 > 完整 > 好看**，且「做全」优先于「精简」。§19 里「只保留唯一路径」的收敛作废。",
  "",
  "多套交互方案（并存，都要能跑通）：",
  "A 拖拽投放（已有）；B 点选投放（点瓶→点器皿）；C 键盘操作（1~9 选动作 / H 提示 / R 重做 / Enter 确认）；",
  "D 事件驱动（`?demo=1&reagent=&vessel=` 与 `window.__chemLabDemoScene.add`）；E 自动演示（右上角演示模式）。",
  "记录里加 `inputMode: drag | click | key | auto`，同一 run 内可混用。",
  "",
  "做全清单（按优先级，砍任何一项都要先说明）：",
  "1. 7 步 × 成功/失败双分支 + 重做（当前 1/4 步）；",
  "2. 五套交互路径全通；",
  "3. 报告按 `runId` 取本次数据（当前演示场景取最新一条）；",
  "4. `/lab/design` 拼接式实验设计（21 条规则已就绪，无 UI）；",
  "5. 其余 9 个实验的演示脚本；",
  "6. 教师端名单/明细/导出全链路；",
  "7. 演示视频（明天再说，今晚不录）。",
  "",
];

fs.writeFileSync(file, Buffer.from(cur + lines.join("\n"), "utf8"));
console.log("已追加 §20");
