import type { DetailRun } from "./types";
import { clampPercent, formatScore } from "./format";

/** 三段分：预习 10% / 操作 40% / 报告 50%，横向三条刻度 */
export function ScoreRulers({ run }: { run: DetailRun | null }) {
  const rows = [
    { label: "预习", weight: "10%", value: run?.scorePre ?? null },
    { label: "操作", weight: "40%", value: run?.scoreOp ?? null },
    { label: "报告", weight: "50%", value: run?.scoreReport ?? null },
  ];

  return (
    <div className="tch-rulers">
      {rows.map((row) => {
        const percent = clampPercent(row.value ?? 0);
        return (
          <div className="tch-ruler" key={row.label}>
            <span className="tch-ruler__label">
              {row.label}
              <span className="tch-ruler__weight mono">{row.weight}</span>
            </span>
            <span className="tch-ruler__track" aria-hidden="true">
              <span className="tch-ruler__fill" style={{ width: `${percent}%` }} />
            </span>
            <span className="tch-ruler__value mono">{formatScore(row.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

const CATEGORY_RANK: Record<string, number> = { K: 0, S: 1, A: 2 };

function orderCode(code: string): number {
  const rank = CATEGORY_RANK[code.charAt(0)] ?? 9;
  const num = Number.parseInt(code.slice(1), 10);
  return rank * 100 + (Number.isNaN(num) ? 99 : num);
}

/** 能力点掌握度：K/S/A 横条 + 等宽百分比 */
export function CompetencyBars({ competency }: { competency: Record<string, number> }) {
  const entries = Object.entries(competency)
    .filter(([, value]) => Number.isFinite(value))
    .sort(([a], [b]) => orderCode(a) - orderCode(b));

  if (entries.length === 0) {
    return <p className="tch-empty-inline">还没有能力点记录，学生完成一步后才会生成。</p>;
  }

  return (
    <ul className="tch-comp">
      {entries.map(([code, value]) => {
        // 契约（data-api confirmed）：competency 为 0~100 的整数百分比
        const percent = clampPercent(value);
        return (
          <li className="tch-comp__row" key={code}>
            <span className="tch-comp__code mono">{code}</span>
            <span className="tch-comp__bar" aria-hidden="true">
              <span className="tch-comp__fill" style={{ width: `${percent}%` }} />
            </span>
            <span className="tch-comp__value mono">{Math.round(percent)}%</span>
          </li>
        );
      })}
    </ul>
  );
}
