import fs from "node:fs";

const file = ".team/DECISIONS.md";
const cur = fs.readFileSync(file, "utf8");
if (cur.includes("## 19.")) {
  console.log("§19 已存在");
  process.exit(0);
}

const lines = [
  "",
  "## 19. 只做一套，做到完整（2026-10-21 00:40）",
  "",
  "用户要求：多套方案先不做，选最稳的那一套做完整。",
  "",
  "定下的唯一路径：",
  "1. 演示 = 页面右上角「演示模式」浮层（`components/demo/demo-overlay.tsx`）。`/demo` 页降级为内部调试入口，不再对外宣传。",
  "2. 实验页 = 单一 `/exp/[id]`，由 `lib/engine.ts` 的 `state.stepIndex` 驱动。`/scene-preview` 只做资产调试，不对外。",
  "3. 报告 = 单一数据源「本次 run 落库」（交卷产生）；seed 数据只作兜底，不对外声称。",
  "4. 事故大秀只出现在演示模式与 `/scene-preview?show=fx`，不单独做页面。",
  "",
  "本轮完成的验收两条命令：",
  "- `node scripts/flow-chain.mjs` → 9/9（门户→登录→选实验→操作→成功→失败→重做→交卷→报告）",
  "- `node scripts/demo-mode-check.mjs` → 全部通过（按钮/浮层/旁白推进/重来/Esc 退出）",
  "",
];

fs.writeFileSync(file, Buffer.from(cur + lines.join("\n"), "utf8"));
console.log("已追加 §19");
