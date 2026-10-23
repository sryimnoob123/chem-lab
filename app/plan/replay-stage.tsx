"use client";

import s from "./plan-replay.module.css";
import type { MotionKind } from "@/lib/plan/piece-motion";

/**
 * 回放舞台：一个 360×200 的 SVG，按动作类型演一小段。
 *
 * 为什么要分动作而不是统一「卡片高亮」：学生拼的是流程，流程的差别在于
 * 「这一块让容器里发生了什么」—— 液面升没升、颜色变没变、指针归没归零。
 * 只高亮卡片等于没演。
 *
 * 动效纪律（AGENTS.md §3.1）：只动 transform / opacity（液面用 scaleY、器皿倾倒用 rotate）；
 * 颜色变化用 fill transition，因为它表达化学结果，不是装饰。
 */

const INK = "var(--ink-2)";
const GLASS = "var(--liquid-sheen)";
const YELLOW = "#E8D26A"; // 甲基橙的黄
const PINK = "#E29AA8"; // 酚酞的微红

/** 称量：药匙落粉 + 指针归零 */
function Weigh() {
  return (
    <g>
      {/* 底座与立柱 */}
      <rect x="112" y="158" width="136" height="7" rx="2" fill={INK} opacity="0.5" />
      <rect x="176" y="112" width="8" height="46" fill={INK} opacity="0.35" />
      {/* 横梁 */}
      <line x1="118" y1="112" x2="242" y2="112" stroke={INK} strokeOpacity="0.6" strokeWidth="2.4" strokeLinecap="round" />
      {/* 左盘（称量瓶） */}
      <g>
        <line x1="136" y1="112" x2="136" y2="122" stroke={INK} strokeOpacity="0.4" strokeWidth="1.4" />
        <path d="M124 122h24l-2 16h-20z" fill={GLASS} stroke={INK} strokeOpacity={0.45} strokeWidth="1.5" />
        <rect x="130" y="134" width="12" height="4" fill="#EDEAE1" />
      </g>
      {/* 右盘（砝码） */}
      <g>
        <line x1="224" y1="112" x2="224" y2="122" stroke={INK} strokeOpacity="0.4" strokeWidth="1.4" />
        <path d="M212 122h24l-2 16h-20z" fill={GLASS} stroke={INK} strokeOpacity={0.45} strokeWidth="1.5" />
      </g>
      {/* 指针：偏 → 归零 */}
      <g className={s.needle} style={{ transformOrigin: "180px 112px" }}>
        <line x1="180" y1="112" x2="180" y2="146" stroke={INK} strokeOpacity="0.75" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <circle cx="180" cy="150" r="3" fill={INK} opacity="0.55" />
      {/* 落下的粉末 */}
      {[168, 174, 180].map((x, i) => (
        <circle
          key={x}
          className={s.dust}
          cx={x}
          cy="96"
          r="1.6"
          fill="#FFFFFF"
          stroke={INK}
          strokeOpacity={0.35}
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </g>
  );
}

/** 倾倒：瓶身倾斜 + 液流 + 受体液面上升 */
function Pour() {
  return (
    <g>
      {/* 受体烧杯 */}
      <defs>
        <clipPath id="clip-beaker">
          <path d="M212 96v72a6 6 0 0 0 6 6h58a6 6 0 0 0 6-6V96z" />
        </clipPath>
      </defs>
      <path d="M212 96v72a6 6 0 0 0 6 6h58a6 6 0 0 0 6-6V96" fill={GLASS} stroke={INK} strokeOpacity={0.45} strokeWidth="1.6" />
      <g clipPath="url(#clip-beaker)">
        <rect className={s.level} x="212" y="146" width="70" height="28" fill="var(--accent)" fillOpacity={0.5} />
      </g>
      <line x1="252" y1="128" x2="266" y2="128" stroke={INK} strokeOpacity={0.3} strokeWidth="1.2" />
      <line x1="252" y1="144" x2="266" y2="144" stroke={INK} strokeOpacity={0.3} strokeWidth="1.2" />
      {/* 倾斜的试剂瓶 */}
      <g className={s.tilt} style={{ transformOrigin: "150px 168px" }}>
        <rect x="126" y="96" width="30" height="72" rx="4" fill={GLASS} stroke={INK} strokeOpacity={0.45} strokeWidth="1.6" />
        <rect x="138" y="88" width="10" height="10" rx="2" fill={INK} opacity="0.55" />
        <rect x="130" y="146" width="22" height="18" fill="var(--accent)" fillOpacity={0.4} />
      </g>
      {/* 液流 */}
      <path className={s.stream} d="M160 96 C 176 92, 196 100, 210 118" stroke="var(--accent)" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** 定量转移 / 定容：液面升到刻度线（刻度在细颈上，这是容量瓶的识别特征） */
function Transfer() {
  return (
    <g>
      <defs>
        <clipPath id="clip-volumetric">
          <path d="M186 74c-24 22-38 46-38 64a12 12 0 0 0 12 12h56a12 12 0 0 0 12-12c0-18-14-42-38-64V52h-4z" />
        </clipPath>
      </defs>
      {/* 瓶身 + 瓶颈 */}
      <path
        d="M186 74c-24 22-38 46-38 64a12 12 0 0 0 12 12h56a12 12 0 0 0 12-12c0-18-14-42-38-64V52h-4z"
        fill={GLASS}
        stroke={INK}
        strokeOpacity={0.45}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      {/* 刻度线：瓶颈处 */}
      <line className={s.mark} x1="176" y1="92" x2="200" y2="92" stroke={INK} strokeOpacity={0.85} strokeWidth="1.6" />
      {/* 液面：裁剪到瓶形，从底部升到刻度 */}
      <g clipPath="url(#clip-volumetric)">
        <rect
          className={s.levelFill}
          x="140"
          y="92"
          width="88"
          height="60"
          fill="var(--accent)"
          fillOpacity={0.4}
          style={{ transformBox: "fill-box", transformOrigin: "bottom" }}
        />
      </g>
      {/* 瓶塞 */}
      <rect x="182" y="44" width="12" height="9" rx="2" fill={INK} opacity="0.5" />
    </g>
  );
}

/** 滴定：逐滴落下 + 指示剂由黄转橙 */
function Titrate() {
  return (
    <g>
      {/* 滴定管 */}
      <rect x="170" y="24" width="12" height="64" rx="2" fill={GLASS} stroke={INK} strokeOpacity={0.45} strokeWidth="1.5" />
      <rect x="170" y="34" width="12" height="44" fill="var(--accent)" fillOpacity={0.35} />
      <path d="M174 88h4l-2 10z" fill={INK} opacity="0.6" />
      {/* 液滴 */}
      {[0, 1, 2].map((i) => (
        <circle key={i} className={s.drop} cx="176" cy="100" r="2.6" fill="var(--accent)" style={{ animationDelay: `${i * 0.45}s` }} />
      ))}
      {/* 锥形瓶 */}
      <defs>
        <clipPath id="clip-flask">
          <path d="M150 122h52l-16 40h-20z" />
        </clipPath>
      </defs>
      <path d="M150 122h52l-16 40h-20z" fill={GLASS} stroke={INK} strokeOpacity={0.45} strokeWidth="1.6" strokeLinejoin="round" />
      <g clipPath="url(#clip-flask)">
        <path className={s.titrand} d="M150 144h52v22h-52z" fill={YELLOW} fillOpacity={0.85} />
      </g>
    </g>
  );
}

/** 加指示剂：一滴落下，液体微变色 */
function Indicate() {
  return (
    <g>
      {/* 滴管 */}
      <rect x="172" y="30" width="10" height="34" rx="3" fill={GLASS} stroke={INK} strokeOpacity={0.45} strokeWidth="1.4" />
      <rect x="174" y="46" width="6" height="14" fill={PINK} fillOpacity={0.8} />
      <circle className={s.oneDrop} cx="177" cy="76" r="2.8" fill={PINK} />
      {/* 锥形瓶 */}
      <defs>
        <clipPath id="clip-flask-ind">
          <path d="M150 108h54l-17 46h-20z" />
        </clipPath>
      </defs>
      <path d="M150 108h54l-17 46h-20z" fill={GLASS} stroke={INK} strokeOpacity={0.45} strokeWidth="1.6" strokeLinejoin="round" />
      <g clipPath="url(#clip-flask-ind)">
        <path className={s.pinkish} d="M150 136h54v20h-54z" fill={PINK} fillOpacity={0.55} />
      </g>
    </g>
  );
}

/** 旋摇：锥形瓶原地摇 */
function Swirl() {
  return (
    <g className={s.swirl} style={{ transformOrigin: "180px 170px" }}>
      <path d="M150 74h60l-19 92h-22z" fill={GLASS} stroke={INK} strokeOpacity={0.45} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M156 138h48l-13 26h-22z" fill="var(--accent)" fillOpacity={0.4} />
      <line x1="150" y1="74" x2="210" y2="74" stroke={INK} strokeOpacity={0.5} strokeWidth="1.8" />
    </g>
  );
}

/** 读数：刻度 + 数字 */
function Read() {
  return (
    <g>
      <rect x="150" y="30" width="16" height="140" rx="2" fill={GLASS} stroke={INK} strokeOpacity={0.45} strokeWidth="1.4" />
      {Array.from({ length: 11 }, (_, i) => (
        <line
          key={i}
          x1="166"
          y1={38 + i * 12}
          x2={i % 5 === 0 ? 180 : 174}
          y2={38 + i * 12}
          stroke={INK}
          strokeOpacity={i % 5 === 0 ? 0.7 : 0.35}
          strokeWidth={i % 5 === 0 ? 1.4 : 1}
        />
      ))}
      {/* 液面读数线 */}
      <line className={s.readLine} x1="150" y1="86" x2="196" y2="86" stroke="var(--accent)" strokeOpacity="0.85" strokeWidth="1.6" />
      <text x="204" y="90" fontSize="13" fill={INK} className={s.readNum}>
        23.45
      </text>
    </g>
  );
}

const STAGE: Record<MotionKind, () => React.ReactElement> = {
  weigh: Weigh,
  pour: Pour,
  transfer: Transfer,
  titrate: Titrate,
  indicate: Indicate,
  swirl: Swirl,
  read: Read,
};

/**
 * 演一步。`key` 由父级按 step 变化，切换时整组重挂载 → CSS 动画重跑（不用手写 reset）。
 */
export function ReplayStage({ motion }: { motion: MotionKind }) {
  const Scene = STAGE[motion];
  return (
    <svg viewBox="118 12 142 168" className={s.stage} role="img" aria-label="方案流程回放">
      <Scene />
    </svg>
  );
}
