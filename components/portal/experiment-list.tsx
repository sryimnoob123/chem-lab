import Link from "next/link";

const ITEMS = [
  {
    id: "exp01",
    no: "01",
    name: "仪器的认领、天平使用及溶液配制",
    note: "洗涤 · 称量 · 定容 · 硫酸稀释",
  },
  {
    id: "exp02",
    no: "02",
    name: "试剂级氯化钠制备",
    note: "除杂 · 过滤 · 蒸发结晶 · 产率",
  },
  {
    id: "exp08",
    no: "08",
    name: "清点仪器，分析天平称量练习",
    note: "固定质量称量 · 递减法 · 记录规范",
  },
  {
    id: "exp09",
    no: "09",
    name: "酸碱标准溶液的配制与浓度比较",
    note: "滴定管润洗 · 半滴操作 · 终点判定",
  },
  {
    id: "exp10",
    no: "10",
    name: "盐酸标准溶液的标定与工业纯碱总碱度测定",
    note: "基准物质标定 · 双指示剂法",
  },
];

export function ExperimentList() {
  return (
    <div className="exp-list">
      <ol className="exp-list__items" aria-label="实验目录">
        {ITEMS.map((item) => (
          <li key={item.id}>
            <Link className="exp-list__row" href={`/exp/${item.id}`} data-demo-id={`demo-home-${item.id}`}>
              <span className="exp-list__no mono">{item.no}</span>
              <span className="exp-list__body">
                <span className="exp-list__name">{item.name}</span>
                <span className="exp-list__note">{item.note}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <Link className="exp-list__all" href="/experiments">
        查看全部 10 个实验 <span className="exp-list__arrow" aria-hidden="true">→</span>
      </Link>

      <style>{`
        .exp-list {
          width: 100%;
          max-width: 840px;
        }
        .exp-list__items {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          column-gap: 30px;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .exp-list__row {
          display: grid;
          grid-template-columns: 30px minmax(0, 1fr);
          gap: 10px;
          min-height: 46px;
          padding: 8px 8px 8px 0;
          border-top: 1px solid var(--line);
          transition: background-color 160ms var(--ease-out), transform 160ms var(--ease-out);
        }
        .exp-list__no {
          font-size: 12px;
          line-height: 1.5;
          color: var(--river-700);
        }
        .exp-list__body { min-width: 0; }
        .exp-list__name {
          display: block;
          font-size: 14px;
          line-height: 1.35;
          font-weight: 500;
          color: var(--ink);
          transition: color 160ms var(--ease-out);
        }
        .exp-list__note {
          display: block;
          margin-top: 2px;
          overflow: hidden;
          color: var(--ink-2);
          font-size: 11px;
          line-height: 1.4;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .exp-list__all {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 14px;
          padding-bottom: 2px;
          border-bottom: 1px solid var(--line);
          color: var(--ink-2);
          font-size: 12px;
          transition: color 160ms var(--ease-out), border-color 160ms var(--ease-out);
        }
        .exp-list__arrow {
          display: inline-block;
          transition: transform 160ms var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .exp-list__row:hover {
            background: rgba(35, 48, 127, .045);
            transform: translateX(2px);
          }
          .exp-list__row:hover .exp-list__name { color: var(--river-700); }
          .exp-list__all:hover {
            color: var(--river-700);
            border-color: var(--river-700);
          }
          .exp-list__all:hover .exp-list__arrow { transform: translateX(2px); }
        }
        @media (max-width: 720px) {
          .exp-list__items { grid-template-columns: 1fr; }
          .exp-list__row { min-height: 44px; }
          .exp-list__name { font-size: 13px; }
          .exp-list__all { margin-top: 12px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .exp-list__row,
          .exp-list__name,
          .exp-list__all,
          .exp-list__arrow { transition: none; }
        }
      `}</style>
    </div>
  );
}
