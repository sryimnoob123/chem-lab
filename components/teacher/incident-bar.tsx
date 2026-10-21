import type { IncidentLevel, IncidentStat } from "./types";

const LEVELS: { level: IncidentLevel; name: string }[] = [
  { level: "L1", name: "偏差" },
  { level: "L2", name: "数据作废" },
  { level: "L3", name: "事故" },
  { level: "L4", name: "危险事故" },
];

/** 事故分布：L1~L4 四段水平堆叠条（div/CSS 画，不引图表库） */
export function IncidentBar({ stats }: { stats: IncidentStat[] }) {
  const byLevel = new Map(stats.map((stat) => [stat.level, stat]));
  const total = stats.reduce((sum, stat) => sum + stat.count, 0);
  const top = stats
    .flatMap((stat) => stat.top)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <section className="tch-incidents" aria-labelledby="tch-incidents-title">
      <div className="tch-incidents__bar">
        <div className="tch-subhead">
          <h2 id="tch-incidents-title">事故分布</h2>
          <span className="tch-subhead__meta mono">共 {total} 次</span>
        </div>

        {total > 0 ? (
          <div className="tch-bar" role="img" aria-label={`共 ${total} 次事故，按 L1 至 L4 堆叠`}>
            {LEVELS.map(({ level }) => {
              const count = byLevel.get(level)?.count ?? 0;
              if (count === 0) return null;
              return (
                <span
                  key={level}
                  className={`tch-bar__seg tch-bar__seg--${level.toLowerCase()}`}
                  style={{ width: `${(count / total) * 100}%` }}
                />
              );
            })}
          </div>
        ) : (
          <p className="tch-empty-inline">暂无事故记录</p>
        )}

        <ul className="tch-legend">
          {LEVELS.map(({ level, name }) => {
            const count = byLevel.get(level)?.count ?? 0;
            return (
              <li key={level}>
                <span className={`tch-swatch tch-bar__seg--${level.toLowerCase()}`} aria-hidden="true" />
                <span className="tch-legend__name">
                  {level} {name}
                </span>
                <span className="mono tch-legend__num">{count}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="tch-incidents__top">
        <div className="tch-subhead">
          <h2>高发事故</h2>
          <span className="tch-subhead__meta">前 3</span>
        </div>
        {top.length > 0 ? (
          <ol className="tch-toplist">
            {top.map((item) => (
              <li key={item.incidentId}>
                <span className="tch-toplist__name">{item.label}</span>
                <span className="mono tch-toplist__num">{item.count} 次</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="tch-empty-inline">本次实验尚未记录事故</p>
        )}
      </div>
    </section>
  );
}
