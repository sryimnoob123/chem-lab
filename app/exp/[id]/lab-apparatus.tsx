type ApparatusProps = {
  className?: string;
  /** 本步该动的那台器皿（"flask" / "burette" / null）：常驻呼吸描边 + 「点这里」。 */
  cue?: string | null;
  /** 指针压着的那台（拖拽/点选时）+ 它到底接不接这瓶试剂。 */
  hover?: string | null;
  hoverValid?: boolean;
  /** 点器皿 = 执行当前建议动作 / 倒进这一台。 */
  onPick?: (id: string) => void;
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
 * 亮场器材：纸白底上用墨线画玻璃（--ink-2 #4A5768），玻璃面只留一层极淡蓝灰，
 * 内壁用 12% 淡阴影代替白高光。"玻璃感" = 深墨线 + 极淡玻璃面 + 内壁阴影。
 * 按真实量程画 0.1 mL 刻度；只负责画，不含任何读数逻辑。
 */
export function LabApparatus({ className, cue = null, hover = null, hoverValid = true, onPick }: ApparatusProps) {
  /**
   * 滴定场景的两台器皿热区（2026-10-22 演示前）：
   * 以前整个台面只有一个大方块接投料，学生看不出「倒进哪台」。
   * 这里给滴定管和锥形瓶各自一个热区（≥44px），点它就是执行本步动作，
   * 拖试剂过来松手就落进这一台 —— 与实验台场景（bench-scene）同一套 data-demo-id 契约，
   * 所以 scene-stage 的 vesselAt()/倾倒动画不用改就能识别。
   */
  const spots = [
    { id: "burette", label: "酸式滴定管", x: 132, y: 20, w: 72, h: 500 },
    { id: "flask", label: "锥形瓶", x: 100, y: 518, w: 146, h: 122 },
  ] as const;
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
      <g stroke="rgba(74,87,104,.62)" strokeWidth="1.6" fill="none">
        <path d="M20 626 H104" />
        <path d="M58 124 V626" />
        <path d="M58 152 H144" />
        <path d="M58 142 V162" />
      </g>
      <rect x="20" y="620" width="84" height="7" fill="rgba(74,87,104,.4)" />

      {/* 滴定管玻璃 */}
      <path
        d="M144 34 H192 V486 H144 Z"
        fill="rgba(74,87,104,.05)"
        stroke="rgba(74,87,104,.75)"
        strokeWidth="1.6"
      />
      <path d="M138 34 H198 M147 24 l-6 10 M189 24 l6 10" fill="none" stroke="rgba(74,87,104,.75)" strokeWidth="1.6" />
      <path d="M150 42 V478" stroke="rgba(74,87,104,.12)" strokeWidth="2" />

      {/* 液体：0.1 mL 分度内可见液面 */}
      <path
        d="M147 84 H189 V474 H147 Z"
        fill="var(--river-700)"
        fillOpacity=".72"
      />
      <path
        d="M147 84 Q168 89 189 84"
        fill="none"
        stroke="#EDF0EE"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M147 474 H189" stroke="rgba(74,87,104,.5)" strokeWidth="1.4" />

      {/* 刻度：0.1 mL 细线，每 5 格加粗 */}
      <g stroke="rgba(74,87,104,.85)">
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
        fill="rgba(74,87,104,.86)"
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
          fill="rgba(74,87,104,.08)"
          stroke="rgba(74,87,104,.75)"
          strokeWidth="1.6"
        />
        <path d="M194 492 l18 -8 v14 l-18 8 Z" fill="rgba(74,87,104,.32)" />
        <path d="M168 508 V520" stroke="rgba(74,87,104,.75)" strokeWidth="1.6" />
        <path d="M164 520 h8 l-2 8 h-4 Z" fill="rgba(74,87,104,.14)" stroke="rgba(74,87,104,.75)" strokeWidth="1.4" />
      </g>

      {/* 液滴 */}
      <g fill="var(--river-700)" fillOpacity=".7">
        <ellipse cx="168" cy="536" rx="2.6" ry="4.2" />
      </g>

      {/* 锥形瓶 */}
      <g>
        <path
          d="M148 530 h48 v30 l42 72 q4 8 -6 8 H112 q-10 0 -6 -8 l42 -72 Z"
          fill="rgba(74,87,104,.05)"
          stroke="rgba(74,87,104,.75)"
          strokeWidth="1.6"
        />
        <path d="M144 530 H200" stroke="rgba(74,87,104,.75)" strokeWidth="1.6" />
        <path d="M119 586 l-16 46" stroke="rgba(74,87,104,.12)" strokeWidth="2" />
        <clipPath id="flask-liquid-clip">
          <path d="M148 530 h48 v30 l42 72 q4 8 -6 8 H112 q-10 0 -6 -8 l42 -72 Z" />
        </clipPath>
        {/* 锥形瓶液体（用户 2026-10-22 报「色块有问题」）：
            之前是一整块硬边矩形 fillOpacity .72，像贴了一张色纸。
            现在：垂直渐变（液面亮、瓶底沉）+ 液面双层椭圆高光，和玻璃器皿同一套画法。 */}
        <defs>
          <linearGradient id="flask-liquid-depth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--river-700)" stopOpacity="0.58" />
            <stop offset="22%" stopColor="var(--river-700)" stopOpacity="0.72" />
            <stop offset="100%" stopColor="var(--river-700)" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <g clipPath="url(#flask-liquid-clip)">
          <rect x="88" y="604" width="172" height="40" fill="url(#flask-liquid-depth)" />
          {/* 这条 path 的 d 被 pour.tsx 的液面抬升动画按选择器锁定（translateY 34→0），
              改 d 会让倒入时液面不动 —— 保留原样，只在其上加两层椭圆做厚度。 */}
          <path d="M88 604 H260" stroke="#EDF0EE" strokeWidth="2" />
          {/* 液面：外圈柔和反光 + 内圈实线，两层才像有厚度的液面 */}
          <ellipse cx="176" cy="604" rx="72" ry="4.6" fill="none" stroke="#EDF0EE" strokeWidth="3" strokeOpacity="0.5" />
          <ellipse cx="176" cy="604" rx="72" ry="4.6" fill="none" stroke="#EDF0EE" strokeWidth="1.1" strokeOpacity="0.9" />
          {/* 瓶内壁的淡阴影（纸白底上用淡墨而不是白高光） */}
          <path d="M100 612 q-8 34 12 44" fill="none" stroke="rgba(74,87,104,.16)" strokeWidth="3" />
          {/* 少量气泡：慢速上浮，证明是液体不是色块 */}
          <circle cx="150" cy="628" r="1.6" fill="#FFFFFF" fillOpacity="0.42">
            <animate attributeName="cy" values="636;610" dur="4.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0" dur="4.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="196" cy="632" r="1.2" fill="#FFFFFF" fillOpacity="0.36">
            <animate attributeName="cy" values="640;614" dur="5.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.45;0" dur="5.6s" repeatCount="indefinite" />
          </circle>
        </g>
        <text
          x="176"
          y="578"
          textAnchor="middle"
          fill="rgba(74,87,104,.8)"
          fontFamily="'IBM Plex Mono', Consolas, monospace"
          fontSize="13"
        >
          250
        </text>
      </g>

      {/* 器皿热区：每台自己亮、自己报名字（替代过去盖住整台的大方块） */}
      {spots.map((spot) => {
        const isCue = cue === spot.id && hover !== spot.id;
        const isHover = hover === spot.id;
        return (
          <g
            key={spot.id}
            data-demo-id={`demo-scene-vessel-${spot.id}`}
            data-cue={isCue ? "true" : "false"}
            data-drop-hover={isHover ? (hoverValid ? "valid" : "invalid") : "false"}
            role="button"
            tabIndex={0}
            aria-label={`${spot.label}：点一下执行这一步的动作，也可以把试剂拖进来`}
            style={{ cursor: onPick ? "pointer" : "default" }}
            onClick={() => onPick?.(spot.id)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onPick?.(spot.id);
            }}
          >
            <rect x={spot.x} y={spot.y} width={spot.w} height={spot.h} rx={10} fill="transparent" />
            {isCue ? (
              <rect
                className="apparatus-cue-ring"
                x={spot.x}
                y={spot.y}
                width={spot.w}
                height={spot.h}
                rx={10}
              />
            ) : null}
            {isHover ? (
              <rect
                x={spot.x}
                y={spot.y}
                width={spot.w}
                height={spot.h}
                rx={10}
                fill="none"
                stroke={hoverValid ? "var(--river-700)" : "#BE3E3E"}
                strokeWidth={2.4}
              />
            ) : null}
            {isCue || isHover ? (
              <g pointerEvents="none">
                <rect
                  x={spot.x + spot.w / 2 - 40}
                  y={spot.y - 26}
                  width={80}
                  height={22}
                  rx={11}
                  fill={isHover && !hoverValid ? "#BE3E3E" : "var(--river-700)"}
                  opacity={0.94}
                />
                <text
                  x={spot.x + spot.w / 2}
                  y={spot.y - 10}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize={12}
                >
                  {isHover ? (hoverValid ? `落进 ${spot.label}` : `${spot.label} 不行`) : "点这里"}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
