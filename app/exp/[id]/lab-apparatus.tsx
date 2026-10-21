type ApparatusProps = {
  className?: string;
};

const GRADUATIONS = Array.from({ length: 51 }, (_, index) => {
  const y = 84 + index * 7.6;
  return {
    index,
    y,
    major: index % 5 === 0,
    label: index % 10 === 0 ? String(index) : null,
  };
});

/**
 * 暗场专用器材：亮描边、可见液面、按真实量程的 0.1 mL 刻度。
 * 只负责画，不含任何读数逻辑。
 */
export function LabApparatus({ className }: ApparatusProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 360 640"
      role="img"
      aria-labelledby="apparatus-title"
    >
      <title id="apparatus-title">
        酸式滴定管 50 mL 与 250 mL 锥形瓶，液面在零刻度附近，管尖无气泡
      </title>

      {/* 支架 */}
      <g stroke="rgba(201,214,228,.62)" strokeWidth="1.6" fill="none">
        <path d="M20 626 H104" />
        <path d="M58 124 V626" />
        <path d="M58 152 H144" />
        <path d="M58 142 V162" />
      </g>
      <rect x="20" y="620" width="84" height="7" fill="rgba(201,214,228,.4)" />

      {/* 滴定管玻璃 */}
      <path
        d="M144 34 H192 V486 H144 Z"
        fill="rgba(201,214,228,.05)"
        stroke="rgba(201,214,228,.75)"
        strokeWidth="1.6"
      />
      <path d="M138 34 H198 M147 24 l-6 10 M189 24 l6 10" fill="none" stroke="rgba(201,214,228,.75)" strokeWidth="1.6" />
      <path d="M150 42 V478" stroke="rgba(255,255,255,.35)" strokeWidth="2" />

      {/* 液体：0.1 mL 分度内可见液面 */}
      <path
        d="M147 84 H189 V474 H147 Z"
        fill="var(--river-700)"
        fillOpacity=".55"
      />
      <path
        d="M147 84 Q168 89 189 84"
        fill="none"
        stroke="#E6EEF7"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M147 474 H189" stroke="rgba(201,214,228,.5)" strokeWidth="1.4" />

      {/* 刻度：0.1 mL 细线，每 5 格加粗 */}
      <g stroke="rgba(201,214,228,.85)">
        {GRADUATIONS.map((tick) => (
          <line
            key={tick.index}
            x1={tick.major ? 176 : 182}
            x2="189"
            y1={tick.y}
            y2={tick.y}
            strokeWidth={tick.major ? 1.4 : 0.7}
            opacity={tick.major ? 0.9 : 0.62}
          />
        ))}
      </g>
      <g
        fill="rgba(201,214,228,.86)"
        fontFamily="'IBM Plex Mono', Consolas, monospace"
        fontSize="14"
      >
        {GRADUATIONS.filter((tick) => tick.label !== null).map((tick) => (
          <text key={`label-${tick.index}`} x="198" y={tick.y + 5}>
            {tick.label}
          </text>
        ))}
      </g>

      {/* 活塞与管尖 */}
      <g>
        <rect
          x="142"
          y="486"
          width="52"
          height="22"
          rx="2"
          fill="rgba(201,214,228,.08)"
          stroke="rgba(201,214,228,.75)"
          strokeWidth="1.6"
        />
        <path d="M194 492 l18 -8 v14 l-18 8 Z" fill="rgba(201,214,228,.32)" />
        <path d="M168 508 V520" stroke="rgba(201,214,228,.75)" strokeWidth="1.6" />
        <path d="M164 520 h8 l-2 8 h-4 Z" fill="rgba(201,214,228,.14)" stroke="rgba(201,214,228,.75)" strokeWidth="1.4" />
      </g>

      {/* 液滴 */}
      <g fill="#E6EEF7" opacity=".82">
        <ellipse cx="168" cy="536" rx="2.6" ry="4.2" />
      </g>

      {/* 锥形瓶 */}
      <g>
        <path
          d="M148 530 h48 v30 l42 72 q4 8 -6 8 H112 q-10 0 -6 -8 l42 -72 Z"
          fill="rgba(201,214,228,.05)"
          stroke="rgba(201,214,228,.75)"
          strokeWidth="1.6"
        />
        <path d="M144 530 H200" stroke="rgba(201,214,228,.75)" strokeWidth="1.6" />
        <path d="M119 586 l-16 46" stroke="rgba(255,255,255,.32)" strokeWidth="2" />
        <clipPath id="flask-liquid-clip">
          <path d="M148 530 h48 v30 l42 72 q4 8 -6 8 H112 q-10 0 -6 -8 l42 -72 Z" />
        </clipPath>
        <g clipPath="url(#flask-liquid-clip)">
          <rect x="88" y="604" width="172" height="40" fill="var(--river-700)" fillOpacity=".55" />
          <path d="M88 604 H260" stroke="#E6EEF7" strokeWidth="2" />
        </g>
        <text
          x="176"
          y="578"
          textAnchor="middle"
          fill="rgba(201,214,228,.8)"
          fontFamily="'IBM Plex Mono', Consolas, monospace"
          fontSize="13"
        >
          250
        </text>
      </g>
    </svg>
  );
}
