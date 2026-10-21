/**
 * 封面主视觉：暗场实验台（纯 SVG，1440×900，slice 铺满）。
 *
 * 构图约束：
 * - 器材集中在中偏左（x 560~1000）与下方台面，右栏是功能卡，不许被器材干扰
 * - 台面线在 y=700，器材都落在台面上
 * - 玻璃用亮描边（暗场上不用深色线），液体用实色 + 液面亮线
 */
export function LabScene({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      role="presentation"
    >
      <defs>
        <linearGradient id="lab-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B1219" />
          <stop offset="58%" stopColor="#0E1620" />
          <stop offset="100%" stopColor="#0A1017" />
        </linearGradient>
        <linearGradient id="lab-bench" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1C2836" />
          <stop offset="100%" stopColor="#121A24" />
        </linearGradient>
        <linearGradient id="lab-alkali" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2FBFA6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0B5D52" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="lab-acid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8B33A" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#B9862A" stopOpacity="0.6" />
        </linearGradient>
        <radialGradient id="lab-glow" cx="0.52" cy="0.36" r="0.46">
          <stop offset="0%" stopColor="#3A4BA8" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#3A4BA8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lab-lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#C9D6E4" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#C9D6E4" stopOpacity="0" />
        </radialGradient>
        <pattern id="lab-grid" width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M56 0H0V56" fill="none" stroke="#C9D6E4" strokeOpacity="0.045" strokeWidth="1" />
        </pattern>
        <clipPath id="lab-flask-clip">
          <path d="M30 0h28v52l48 96a15 15 0 0 1-13 22H-5a15 15 0 0 1-13-22L30 52Z" />
        </clipPath>
        <linearGradient id="lab-pink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F2A0A8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#C4434F" stopOpacity="0.5" />
        </linearGradient>
      </defs>

      <rect width="1440" height="900" fill="url(#lab-sky)" />
      <rect width="1440" height="900" fill="url(#lab-grid)" />
      <rect width="1440" height="900" fill="url(#lab-glow)" />
      <ellipse cx="780" cy="150" rx="360" ry="200" fill="url(#lab-lamp)" />

      {/* 台面 */}
      <rect x="0" y="700" width="1440" height="200" fill="url(#lab-bench)" />
      <line x1="0" y1="700" x2="1440" y2="700" stroke="#C9D6E4" strokeOpacity="0.4" strokeWidth="1.6" />
      <line x1="0" y1="707" x2="1440" y2="707" stroke="#C9D6E4" strokeOpacity="0.1" strokeWidth="1" />
      {/* 台面聚光 */}
      <ellipse cx="800" cy="704" rx="330" ry="46" fill="#C9D6E4" opacity="0.05" />
      {/* 器物接触阴影 */}
      <ellipse cx="737" cy="702" rx="22" ry="4" fill="#000" opacity="0.45" />
      <ellipse cx="890" cy="702" rx="66" ry="5" fill="#000" opacity="0.5" />
      <ellipse cx="992" cy="700" rx="50" ry="4" fill="#000" opacity="0.5" />
      <ellipse cx="581" cy="702" rx="30" ry="4" fill="#000" opacity="0.45" />
      <ellipse cx="620" cy="702" rx="24" ry="3" fill="#000" opacity="0.45" />
      <ellipse cx="1076" cy="702" rx="26" ry="3" fill="#000" opacity="0.4" />

      {/* 滴定管架 */}
      <g stroke="#C9D6E4" strokeOpacity="0.45" strokeWidth="3.5" strokeLinecap="round" fill="none">
        <path d="M636 318v382" />
        <path d="M636 700h108" />
        <path d="M690 330h62" />
        <path d="M690 540h62" />
      </g>

      {/* 酸式滴定管 50 mL */}
      <g transform="translate(724 330)">
        <rect
          x="0" y="0" width="26" height="300" rx="3"
          fill="#FFFFFF" fillOpacity="0.07"
          stroke="#C9D6E4" strokeOpacity="0.85" strokeWidth="1.7"
        />
        <rect x="3.5" y="104" width="19" height="176" fill="url(#lab-alkali)" />
        <line x1="3.5" y1="104" x2="22.5" y2="104" stroke="#8FF0DE" strokeWidth="2" />
        {Array.from({ length: 22 }, (_, i) => (
          <line
            key={i}
            x1={i % 5 === 0 ? 2 : 10}
            y1={14 + i * 12}
            x2={24}
            y2={14 + i * 12}
            stroke="#C9D6E4"
            strokeOpacity={i % 5 === 0 ? 0.8 : 0.4}
            strokeWidth={i % 5 === 0 ? 1.5 : 1}
          />
        ))}
        <rect x="1" y="296" width="24" height="13" rx="2" fill="#C9D6E4" fillOpacity="0.4" stroke="#C9D6E4" strokeOpacity="0.8" strokeWidth="1.4" />
        <path d="M13 309v24l-5 9a3.6 3.6 0 0 0 3 6.4h4a3.6 3.6 0 0 0 3-6.4l-5-9" fill="#FFFFFF" fillOpacity="0.1" stroke="#C9D6E4" strokeOpacity="0.8" strokeWidth="1.4" />
      </g>

      {/* 液滴（CSS 也有一份，这里给静态钩子） */}
      <ellipse cx="737" cy="400" rx="3.2" ry="4.8" fill="#8FF0DE" opacity="0.85">
        <animate attributeName="cy" values="392;440;486" dur="2.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.9;0.9;0" dur="2.8s" repeatCount="indefinite" />
      </ellipse>

      {/* 锥形瓶 250 mL（正在滴定，接近终点微红） */}
      <g transform="translate(846 530)">
        <g clipPath="url(#lab-flask-clip)">
          <rect x="-40" y="126" width="180" height="60" fill="url(#lab-pink)" />
        </g>
        <path
          d="M30 0h28v52l48 96a15 15 0 0 1-13 22H-5a15 15 0 0 1-13-22L30 52Z"
          fill="#FFFFFF" fillOpacity="0.06"
          stroke="#C9D6E4" strokeOpacity="0.8" strokeWidth="1.7"
        />
        <line x1="-11" y1="126" x2="49" y2="126" stroke="#F2A0A8" strokeOpacity="0.8" strokeWidth="1.8" />
        <line x1="30" y1="0" x2="58" y2="0" stroke="#C9D6E4" strokeOpacity="0.55" strokeWidth="1.4" />
      </g>

      {/* 烧杯（含盐酸） */}
      <g transform="translate(950 604)">
        <path d="M0 0h84v80a12 12 0 0 1-12 12H12A12 12 0 0 1 0 80Z" fill="#FFFFFF" fillOpacity="0.05" stroke="#C9D6E4" strokeOpacity="0.7" strokeWidth="1.5" />
        <rect x="2" y="38" width="80" height="54" fill="url(#lab-acid)" />
        <line x1="2" y1="38" x2="82" y2="38" stroke="#F0C96A" strokeOpacity="0.65" strokeWidth="1.5" />
        <path d="M84 22h12a7 7 0 0 1 0 14H84" fill="none" stroke="#C9D6E4" strokeOpacity="0.7" strokeWidth="1.5" />
        {[52, 64, 76, 88].map((y) => (
          <line key={y} x1="68" y1={y} x2="82" y2={y} stroke="#C9D6E4" strokeOpacity="0.45" strokeWidth="1" />
        ))}
      </g>

      {/* 试剂瓶两只 */}
      <g transform="translate(556 612)">
        <rect x="0" y="24" width="50" height="64" rx="3" fill="#FFFFFF" fillOpacity="0.05" stroke="#C9D6E4" strokeOpacity="0.62" strokeWidth="1.4" />
        <rect x="9" y="4" width="32" height="20" rx="2" fill="#C9D6E4" fillOpacity="0.3" stroke="#C9D6E4" strokeOpacity="0.6" strokeWidth="1.2" />
        <rect x="4" y="52" width="42" height="18" fill="#2FBFA6" fillOpacity="0.25" />
      </g>
      <g transform="translate(600 636)">
        <rect x="0" y="16" width="40" height="52" rx="3" fill="#FFFFFF" fillOpacity="0.04" stroke="#C9D6E4" strokeOpacity="0.5" strokeWidth="1.2" />
        <rect x="7" y="0" width="26" height="16" rx="2" fill="#C9D6E4" fillOpacity="0.24" stroke="#C9D6E4" strokeOpacity="0.45" strokeWidth="1" />
      </g>

      {/* 洗耳球小件 */}
      <g transform="translate(1056 656)" stroke="#C9D6E4" strokeOpacity="0.55" fill="#FFFFFF" fillOpacity="0.05">
        <path d="M0 22a20 20 0 0 1 40 0v14H0Z" strokeWidth="1.4" />
        <rect x="14" y="36" width="12" height="14" strokeWidth="1.2" />
      </g>

      {/* 台面反光 */}
      <ellipse cx="860" cy="712" rx="190" ry="7" fill="#8FF0DE" opacity="0.07" />
      <ellipse cx="992" cy="714" rx="90" ry="5" fill="#E8B33A" opacity="0.06" />
    </svg>
  );
}
