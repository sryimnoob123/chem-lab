/**
 * 能力点雷达（纯 SVG，无图表库）。
 *
 * 5 轴 × 3 层网格 × 数据多边形 × 顶点 × 标签 + 数值；顶点挂 <title>，hover 出原生 tooltip。
 * 班级与单学生共用这一个组件，差异只有 `scope` 的文案。
 * 无数据时**不画多边形**，给「暂无数据」空态；单维无记录时数值按 0 画，但图例标「暂无数据」。
 */
import type { RadarSeries } from "./radar-data";
import styles from "./radar-chart.module.css";

export type RadarScope = "class" | "student";

const CHART = {
  width: 420,
  height: 300,
  cx: 210,
  cy: 144,
  radius: 112,
} as const;

const RING_RATIOS = [1 / 3, 2 / 3, 1] as const;
const AXIS_LABEL_GAP = 24;

type Point = { x: number; y: number };

function polar(index: number, total: number, radius: number): Point {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
  return {
    x: CHART.cx + radius * Math.cos(angle),
    y: CHART.cy + radius * Math.sin(angle),
  };
}

function ringPoints(total: number, ratio: number): string {
  return Array.from({ length: total }, (_, index) => {
    const point = polar(index, total, CHART.radius * ratio);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(" ");
}

function valuePoints(values: readonly number[], total: number): string {
  return values
    .map((value, index) => {
      const point = polar(index, total, (CHART.radius * value) / 100);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function labelAnchor(cos: number): "middle" | "start" | "end" {
  if (Math.abs(cos) < 0.25) return "middle";
  return cos > 0 ? "start" : "end";
}

export function CompetencyRadar({
  series,
  scope,
  title,
}: {
  series: RadarSeries;
  scope: RadarScope;
  title: string;
}) {
  const total = series.dims.length;

  if (!series.hasData) {
    return (
      <div className={styles.empty} role="status">
        <p className={styles.emptyTitle}>暂无能力点数据</p>
        <p className={styles.emptyBody}>
          该范围还没有可用的能力点记录；学生完成操作后自动生成。未记录不代表 0 分。
        </p>
      </div>
    );
  }

  const missing = series.dims.filter((dim) => !dim.hasData).map((dim) => dim.code);
  const scopeText =
    scope === "class"
      ? `全班均分 · 覆盖 ${series.sampleCount} 次实验记录`
      : `本生均分 · 覆盖 ${series.sampleCount} 次实验`;
  const ariaLabel = `${title}：${series.dims
    .map((dim) => `${dim.code} ${dim.hasData ? `${dim.value} 分` : "暂无数据"}`)
    .join("，")}`;

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${CHART.width} ${CHART.height}`}
        role="img"
        aria-label={ariaLabel}
      >
        <g aria-hidden="true">
          {RING_RATIOS.map((ratio) => (
            <polygon key={ratio} className={styles.grid} points={ringPoints(total, ratio)} />
          ))}
          {series.dims.map((dim, index) => {
            const point = polar(index, total, CHART.radius);
            return (
              <line
                key={dim.code}
                className={styles.axis}
                x1={CHART.cx}
                y1={CHART.cy}
                x2={point.x}
                y2={point.y}
              />
            );
          })}
        </g>

        <polygon className={styles.area} points={valuePoints(series.dims.map((dim) => dim.value), total)} />

        {series.dims.map((dim, index) => {
          const point = polar(index, total, (CHART.radius * dim.value) / 100);
          const detail = dim.hasData ? `${dim.value} 分` : "暂无数据（按 0 画）";
          return (
            <circle key={dim.code} className={styles.vertex} cx={point.x} cy={point.y} r={3.5}>
              <title>{`${dim.code} ${dim.category}：${detail}`}</title>
            </circle>
          );
        })}

        {series.dims.map((dim, index) => {
          const point = polar(index, total, CHART.radius + AXIS_LABEL_GAP);
          const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total;
          const anchor = labelAnchor(Math.cos(angle));
          return (
            <g key={dim.code}>
              <text className={styles.code} x={point.x} y={point.y} textAnchor={anchor}>
                {dim.code} {dim.category}
              </text>
              <text className={styles.value} x={point.x} y={point.y + 15} textAnchor={anchor}>
                {dim.hasData ? dim.value : 0}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className={styles.caption}>
        <span className={styles.captionTitle}>{title}</span>
        <span className={styles.captionMeta}>{scopeText}</span>
      </figcaption>

      <ul className={styles.legend}>
        {series.dims.map((dim) => (
          <li key={dim.code} className={styles.legendItem}>
            <span className={styles.legendCode}>{dim.code}</span>
            <span className={styles.legendValue}>{dim.hasData ? dim.value : 0}</span>
            {dim.hasData ? null : <span className={styles.legendMissing}>暂无数据</span>}
          </li>
        ))}
      </ul>

      {missing.length > 0 ? (
        <p className={styles.note}>
          {missing.join(" ")} 暂无记录，按 0 画；不代表学生掌握度为 0。
        </p>
      ) : null}
    </figure>
  );
}
