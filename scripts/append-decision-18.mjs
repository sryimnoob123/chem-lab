import fs from "node:fs";

const file = ".team/DECISIONS.md";
const cur = fs.readFileSync(file, "utf8");
if (cur.includes("## 18.")) {
  console.log("§18 已存在，跳过");
  process.exit(0);
}

const lines = [
  "",
  "## 18. 每一步两条分支：成功 / 失败 / 可重做（2026-10-20 23:20）",
  "",
  "用户要求：每一步都要有成功和失败两条分支。对了给漂亮的正反馈动画（液体变色、气泡上升、沉淀缓降、视觉脉冲）；错了给有教学意义的失败动画，并明确告诉学生为什么错（例：滴定管不能直接投加固体会堵塞），失败后能重做。",
  "",
  "规矩：",
  "1. 成功分支 = 器皿脉冲（360ms）+ 现象动画（变色 600 / 气泡 stagger 90 / 沉淀缓降 900）+ 事件条 --jade-600 + 一句「为什么对」；",
  "2. 失败分支 = 器皿抖动 240ms + 对应事故特效 + 事件条 --danger **固定两行**：第一行「错在哪」≤20 字，第二行「为什么」（机理/规范）；",
  "3. 失败后必须给「重做本步」按钮（44px），点了回到该步开始时的快照，可重新选择；只有 L4（terminate）才终止实验，且终止页也要有重新演示入口；",
  "4. 所有文案取自 experiments/<id>/definition.ts 的 feedback，UI 不得自行编写化学解释；",
  "5. 演示钩子：demo-feedback-ok-<step>、demo-feedback-fail-<step>、demo-retry-<step>。",
  "",
];

fs.writeFileSync(file, Buffer.from(cur + lines.join("\n"), "utf8"));
console.log("已追加 §18");
