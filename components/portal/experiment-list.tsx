import Link from "next/link";

const ITEMS = [
  { id: "exp01", no: "01", name: "仪器的认领、天平使用及溶液配制" },
  { id: "exp02", no: "02", name: "试剂级氯化钠制备" },
  { id: "exp08", no: "08", name: "清点仪器，分析天平称量练习" },
  { id: "exp09", no: "09", name: "酸碱标准溶液的配制与浓度比较" },
  { id: "exp10", no: "10", name: "盐酸标准溶液的标定与工业纯碱总碱度测定" },
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
          /* 5 条分两栏：按列填充（3 + 2），不让最后一行只剩一条挂在左半边 */
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-auto-flow: column;
          grid-template-rows: repeat(3, auto);
          column-gap: var(--sp-6);
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .exp-list__row {
          display: grid;
          grid-template-columns: var(--sp-6) minmax(0, 1fr);
          align-items: center;
          gap: var(--sp-2);
          min-height: 48px;
          padding: var(--sp-2) var(--sp-2) var(--sp-2) 0;
          border-top: 1px solid var(--line);
          transition: background-color 160ms var(--ease-out), transform 160ms var(--ease-out);
        }
        .exp-list__no {
          font-size: var(--type-meta);
          line-height: var(--lh-meta);
          color: var(--river-700);
        }
        .exp-list__body { min-width: 0; }
        .exp-list__name {
          display: block;
          font-size: var(--type-body);
          line-height: 1.4;
          font-weight: 500;
          color: var(--ink);
          transition: color 160ms var(--ease-out);
        }
        .exp-list__all {
          display: inline-flex;
          align-items: center;
          gap: var(--sp-1);
          margin-top: var(--sp-3);
          padding-bottom: 2px;
          border-bottom: 1px solid var(--line);
          color: var(--ink-2);
          font-size: var(--type-meta);
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
