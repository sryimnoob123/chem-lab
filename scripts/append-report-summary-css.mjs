/**
 * 报告页「本次总结」卡片样式（一次性追加，幂等）。
 */
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "app/exp/[id]/report/report.module.css");
const MARK = "/* ===== 本次总结（2026-10-21） ===== */";

const CSS = `
${MARK}
.summary {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 20px;
  align-items: center;
  margin: 18px 0 6px;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--river-700);
  border-radius: 2px;
  background: #fff;
}
.summary[data-tone="great"] {
  border-left-color: var(--jade-600);
}
.summary[data-tone="needs-work"] {
  border-left-color: var(--warn);
}
.summaryLead {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.summaryKicker {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--ink-2);
}
.summaryLine {
  margin: 0;
  font-size: 17px;
  line-height: 1.45;
  font-weight: 500;
  color: var(--ink);
}
.summaryFacts {
  display: flex;
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.summaryFacts li {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.summaryFactLabel {
  font-size: 11px;
  color: var(--ink-2);
}
.summaryFactValue {
  font-family: var(--font-mono);
  font-size: 20px;
  line-height: 1.1;
  color: var(--ink);
}
.summaryFactValue[data-tone="warn"] {
  color: var(--danger);
}

@media (max-width: 720px) {
  .summary {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .summaryFacts {
    justify-content: space-between;
  }
}
`;

const text = fs.readFileSync(file, "utf8");
if (text.includes(MARK)) {
  console.log("已存在，跳过");
} else {
  fs.writeFileSync(file, text + CSS, "utf8");
  console.log("已追加报告总结样式");
}
