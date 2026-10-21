import type { DetailIncident, DetailTimelineEntry, IncidentLevel } from "./types";
import { formatDateTime } from "./format";

const LEVEL_NAME: Record<IncidentLevel, string> = {
  L1: "偏差",
  L2: "数据作废",
  L3: "事故",
  L4: "危险事故",
};

/** 事故清单：等级 + 名称 + 发生在第几步 + 时间 */
export function IncidentLog({ incidents }: { incidents: DetailIncident[] }) {
  if (incidents.length === 0) {
    return <p className="tch-empty-inline">本次实验未触发任何事故。</p>;
  }

  return (
    <>
      <div className="tch-log__head" aria-hidden="true">
        <span>等级</span>
        <span>事故</span>
        <span>步骤</span>
        <span>时间</span>
      </div>
      <ul className="tch-log">
        {incidents.map((item, index) => (
          <li className="tch-log__row" key={`${item.incidentId}-${index}`}>
            <span className={`tch-level tch-level--${item.level.toLowerCase()}`}>
              {item.level} {LEVEL_NAME[item.level]}
            </span>
            <span className="tch-log__main">{item.label}</span>
            <span className="tch-log__meta">第 {item.stepIndex + 1} 步</span>
            <span className="tch-log__meta mono">{formatDateTime(item.at)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** 最近操作时间线：第 N 步 · 动作 · 正确/错误 · 扣分（等宽体） */
export function TimelineLog({ timeline }: { timeline: DetailTimelineEntry[] }) {
  if (timeline.length === 0) {
    return <p className="tch-empty-inline">还没有操作记录。</p>;
  }

  // 时间线是"操作流水"：按步骤倒序（最近一步在上），同一步内再看时间。
  // 不按 at 全局排序——演示/回溯数据里同一 run 的 at 可能被压缩到同一秒，
  // 按 at 单独排会把步骤打乱（第 7 步夹在第 4 步下面）。
  const rows = [...timeline]
    .sort((a, b) => b.stepIndex - a.stepIndex || b.at.getTime() - a.at.getTime())
    .slice(0, 30);

  return (
    <>
      <div className="tch-timeline__head" aria-hidden="true">
        <span>步骤</span>
        <span>动作</span>
        <span>判定</span>
        <span className="tch-timeline__deduct">扣分</span>
      </div>
      <ol className="tch-timeline">
        {rows.map((entry, index) => (
          <li
            className="tch-timeline__row"
            key={`${entry.stepIndex}-${entry.choiceId}-${index}`}
            data-state={entry.correct ? "ok" : "bad"}
          >
            <span className="tch-timeline__step mono">第 {entry.stepIndex + 1} 步</span>
            <span className="tch-timeline__action">{entry.label || entry.actionType}</span>
            <span className="tch-timeline__result">{entry.correct ? "正确" : "错误"}</span>
            <span className="tch-timeline__deduct mono">{entry.deduct > 0 ? `−${entry.deduct}` : "0"}</span>
          </li>
        ))}
      </ol>
    </>
  );
}
