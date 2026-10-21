"use client";

/** 十件器皿的极简线稿；只有编号，不加说明文字。 */
const VESSELS: readonly { d: string; liquid?: string }[] = [
  // 1 试管
  {
    d: "M14 5h12v27a6 6 0 0 1-12 0V5Z M14 9h12",
    liquid: "M14 27h12v5a6 6 0 0 1-12 0v-5Z",
  },
  // 2 烧杯
  {
    d: "M8 10h24v25H8V10Z M8 13h4 M36 17h4 M12 35h16",
    liquid: "M8 24h24v11H8V24Z",
  },
  // 3 锥形瓶
  {
    d: "M17 5h6v15l9 16a4 4 0 0 1-3.5 6h-17A4 4 0 0 1 8 36l9-16V5Z M15 5h10",
    liquid: "M12 30h16l5 8a4 4 0 0 1-3.5 5h-19A4 4 0 0 1 7 38l5-8Z",
  },
  // 4 容量瓶
  {
    d: "M17 5h6v13l7 12a5 5 0 0 1-4.3 7.5H14.3A5 5 0 0 1 10 30l7-12V5Z M15 5h10 M11 25h18",
    liquid: "M13 30h14l3 5a5 5 0 0 1-4.3 7.5H14.3A5 5 0 0 1 10 35l3-5Z",
  },
  // 5 滴定管
  {
    d: "M18 3h4v32h-4V3Z M16 14h8 M20 35v5 M16 40h8 M15 25h10",
    liquid: "M18 8h4v24h-4V8Z",
  },
  // 6 量筒
  {
    d: "M12 5h16v35H12V5Z M12 10h5 M12 15h5 M12 20h5 M12 25h5 M12 30h5 M12 35h5",
    liquid: "M12 18h16v22H12V18Z",
  },
  // 7 移液管
  {
    d: "M21 4h-2v9c0 3-4 5-4 10v17h10V23c0-5-4-7-4-10V4Z M20 4h2 M20 30h4",
    liquid: "M18 25h6v13h-6V25Z",
  },
  // 8 坩埚
  {
    d: "M9 19h22l-3 16H12L9 19Z M7 19h26 M20 12l4-5",
  },
  // 9 表面皿
  {
    d: "M4 24c6-9 26-9 32 0 M8 24h24",
  },
  // 10 漏斗
  {
    d: "M8 8h24L23 25v13h-6V25L8 8Z M17 8V5h6v3",
  },
];

export function VesselGlyph({ index, className }: { index: number; className?: string }) {
  const vessel = VESSELS[index % VESSELS.length];
  return (
    <svg
      className={`vessel-glyph ${className ?? ""}`}
      viewBox="0 0 40 48"
      width={24}
      height={29}
      aria-hidden="true"
      focusable="false"
      style={{ overflow: "visible" }}
    >
      <path
        d={vessel.d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {vessel.liquid ? (
        <path
          className="vessel-glyph__liquid"
          d={vessel.liquid}
          fill="currentColor"
          stroke="none"
          opacity={0.34}
        />
      ) : null}
    </svg>
  );
}

export function VesselStrip({ className }: { className?: string }) {
  return (
    <ul className={`vessel-strip ${className ?? ""}`} aria-label="十个实验器皿">
      {VESSELS.map((vessel, i) => (
        <li className="vessel" key={i} title={`实验 ${String(i + 1).padStart(2, "0")}`}>
          <span className="vessel__icon">
            <svg viewBox="0 0 40 48" aria-hidden="true" focusable="false">
              <path d={vessel.d} />
              {vessel.liquid ? <path className="vessel__liquid" d={vessel.liquid} /> : null}
            </svg>
          </span>
          <span className="vessel__no">{String(i + 1).padStart(2, "0")}</span>
        </li>
      ))}
      <style>{`
        .vessel-strip {
          display: grid;
          grid-template-columns: repeat(10, minmax(0, 1fr));
          gap: 0;
          margin: 0;
          padding: 0;
          list-style: none;
          width: 100%;
          max-width: 640px;
        }
        .vessel {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 7px;
          padding: 8px 0 2px;
          color: rgba(232, 239, 246, .66);
          transition: color 160ms ease;
        }
        .vessel:hover { color: #fff; }
        .vessel__icon {
          display: inline-flex;
          align-items: flex-end;
          justify-content: center;
          width: 30px;
          height: 44px;
          transition: transform 180ms var(--ease-out);
          will-change: transform;
        }
        .vessel:hover .vessel__icon { transform: translateY(-4px); }
        .vessel__icon svg {
          width: 100%;
          height: 100%;
          overflow: visible;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.4;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .vessel__liquid {
          fill: var(--river-500);
          stroke: none;
          opacity: .5;
          transform-box: fill-box;
          transform-origin: center bottom;
          animation: vessel-liquid 4.8s ease-in-out infinite;
        }
        .vessel:nth-child(2n) .vessel__liquid { animation-delay: -1.3s; }
        .vessel:nth-child(3n) .vessel__liquid { animation-delay: -2.4s; }
        .vessel__no {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: .08em;
          line-height: 1;
          color: rgba(232, 239, 246, .38);
        }
        @keyframes vessel-liquid {
          0%, 100% { transform: scaleY(1) translateY(0); }
          50% { transform: scaleY(.94) translateY(-.6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .vessel__icon { transition: none; }
          .vessel__liquid { animation: none; }
        }
      `}</style>
    </ul>
  );
}
