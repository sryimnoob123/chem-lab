import type { OverviewStat } from "./types";
import { formatPercent } from "./format";

type Card = { label: string; value: string; note?: string };

/**
 * 5 张指标：细线分隔的台账格，不是圆角卡片墙。
 *
 * 第三行只放「算出来的比例 / 评分口径」这类看不出来的信息，
 * 不复述标签（"未开始 / 尚未进入实验"这种同义重复 2026-10-23 已删）。
 */
export function StatCards({ stat }: { stat: OverviewStat }) {
  const doneRate = stat.total > 0 ? (stat.done / stat.total) * 100 : 0;
  const doingRate = stat.total > 0 ? (stat.doing / stat.total) * 100 : 0;
  const avg = stat.avgTotal === null ? "—" : stat.avgTotal.toFixed(1);

  const cards: Card[] = [
    { label: "班级学生", value: String(stat.total) },
    { label: "已完成", value: String(stat.done), note: `完成率 ${formatPercent(doneRate)}` },
    { label: "进行中", value: String(stat.doing), note: `占班级 ${formatPercent(doingRate)}` },
    { label: "未开始", value: String(stat.notStarted) },
    { label: "平均总分", value: avg, note: "满分 100" },
  ];

  return (
    <ul className="tch-stats" aria-label="班级学习指标">
      {cards.map((card) => (
        <li className="tch-stat" key={card.label}>
          <span className="tch-stat__label">{card.label}</span>
          <span className="tch-stat__value mono">{card.value}</span>
          {card.note ? <span className="tch-stat__note">{card.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}
