import fs from "node:fs";

const file = ".team/DECISIONS.md";
const buf = fs.readFileSync(file);
const out = [];
let i = 0;
while (i < buf.length) {
  const isBom = buf[i] === 0xef && buf[i + 1] === 0xbb && buf[i + 2] === 0xbf;
  if (isBom && out.length > 0) {
    i += 3;
    continue;
  }
  out.push(buf[i]);
  i += 1;
}

const lines = [
  "",
  "## 17. 交互手感标准：SLG 手游级（2026-10-20 23:10）",
  "",
  "用户要求：点试剂瓶 / 点锥形瓶 / 拖到试管，每一下都要有 100~300ms 的即时反馈（缩放、发光、轻微震感），点了立刻有反应，不许「点了等跳转」。",
  "",
  "规矩：",
  "1. 按下 ≤100ms 必须有可见变化（:active + CSS，禁用 JS 定时器做按下态）；",
  "2. 动作完成 100~300ms 收束（弹一下 / 抖一下），不做无谓等待；",
  "3. 投错目标给**拒收抖动 + 规范文案**，不许静默；",
  "4. 时长收敛成 CSS 变量（--press-in / --press-out / --pop / --shake），不散落硬编码；",
  "5. prefers-reduced-motion 下保留颜色与描边变化，只取消位移。",
  "",
];

const text = Buffer.concat([Buffer.from(out), Buffer.from(lines.join("\n"), "utf8")]).toString("utf8");
fs.writeFileSync(file, Buffer.from(text, "utf8"));
console.log("已清理中间 BOM 并追加 §17，字节数", fs.statSync(file).size);
