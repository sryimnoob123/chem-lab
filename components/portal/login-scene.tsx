import type { CSSProperties } from "react";

import s from "./login-scene.module.css";

/**
 * 登录页背景：与实验操作台同一套器皿画法（几何、描边、玻璃、高光一律照抄
 * components/exp/scene/vessel-art.tsx，保证「登录页 = 实验页」同一视觉语言）。
 *
 * 规范：描边 #16202C @70% / 1.4px、玻璃填充 #fff @50%、左上 2px 白高光 @35%；
 * 液体取真实试剂色 —— 锥形瓶酚酞粉红 #F48FB1、容量瓶高锰酸钾淡紫 #B39DDB、
 * 烧杯硫酸铜淡蓝 #81D4FA、滴定管与量筒的水色 #DCE9F2。
 */

const INK = "#16202C";
const GLASS = { fill: "#fff", fillOpacity: 0.5 } as const;

/* ---- 以下 path 与 vessel-art.tsx 中的同名常量逐字一致 ---- */
const FLASK_BODY = "M63 16 H97 V62 L128 178 Q128 184 122 184 H38 Q32 184 32 178 L63 62 Z";
const BEAKER_BODY = "M26 41 V188 H134 V41 Z";
const VOLUMETRIC_BODY =
  "M68 18 H92 V70 C92 80 128 102 132 134 Q136 162 116 176 Q98 188 80 188 Q62 188 44 176 Q24 162 28 134 C32 102 68 80 68 70 Z";

const FLASK_LIQUID = "M31.0 116 H129.0 L126 178 Q128 184 122 184 H38 Q32 184 34 178 Z";
const BEAKER_LIQUID = "M29 114 H131 V186 H29 Z";
const VOLUMETRIC_LIQUID =
  "M36 140 H124 Q128 160 112 174 Q96 188 80 188 Q64 188 48 174 Q32 160 36 140 Z";

const PINK = "#F48FB1";
const PURPLE = "#B39DDB";
const BLUE = "#81D4FA";
const WATER = "#DCE9F2";

const S = 0.7; // 描边不透明度
const W = 1.4; // 描边宽度

/** 玻璃器皿外壳：白玻璃 + 墨线 + 左上高光，与实验页一致。 */
function Glass({ d, highlight }: { d: string; highlight: string }) {
  return (
    <>
      <path d={d} {...GLASS} />
      <path d={d} fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
      <path d={highlight} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" />
    </>
  );
}

export function LoginScene() {
  return (
    <div className={s.scene} aria-hidden="true">
      {/* ---------------- 桌面版 ---------------- */}
      <svg className={`${s.layer} ${s.desk}`} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        {/* 远景：容量瓶（淡紫）+ 量筒（水色）+ 烧杯（淡蓝）+ 漏斗，共用台面 y=704 */}
        <g className={s.far}>
          <path d="M960 704H1440" fill="none" stroke={INK} strokeOpacity={0.18} strokeWidth={1} />

          <g transform="translate(992 526) scale(0.95)">
            <Glass d={VOLUMETRIC_BODY} highlight="M74 26 V60" />
            <path d="M66 10 H94 V18 H66 Z" {...GLASS} />
            <path d="M66 10 H94 V18 H66 Z" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <line x1="66" y1="40" x2="94" y2="40" stroke={INK} strokeOpacity={0.75} strokeWidth={1.6} />
            <path d={VOLUMETRIC_LIQUID} fill={PURPLE} fillOpacity={0.42} />
          </g>

          <g transform="translate(1146 482)">
            <rect x="0" y="0" width="30" height="222" {...GLASS} />
            <path d="M0 0 V222 M30 0 V222" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M-6 0 H36" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <g stroke={INK} strokeOpacity={0.55} strokeWidth={0.9}>
              {[44, 82, 120, 158, 196].map((y) => (
                <line key={y} x1="0" y1={y} x2="11" y2={y} />
              ))}
            </g>
            <path d="M1 104 H29 V222 H1 Z" fill={WATER} fillOpacity={0.44} />
            <line x1="4" y1="10" x2="4" y2="212" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          </g>

          <g transform="translate(1240 557) scale(0.72)">
            <path d={BEAKER_BODY} {...GLASS} />
            <path d={BEAKER_BODY} fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <ellipse cx="80" cy="41" rx="54" ry="7.5" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d={BEAKER_LIQUID} fill={BLUE} fillOpacity={0.45} />
            <line x1="31.5" y1="56" x2="31.5" y2="180" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* 漏斗 + 滤纸锥，立在台面上 */}
          <g transform="translate(1348 618) scale(0.82)">
            <path d="M-42 -46 H42 L6 6 H-6 Z" {...GLASS} />
            <path d="M-42 -46 H42 L6 6 H-6 Z" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M-32 -46 L-3 6 M32 -46 L3 6" fill="none" stroke={INK} strokeOpacity="0.45" strokeWidth="0.9" />
            <path d="M-4 6 V86 M4 6 V86" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M-36 -42 L-30 -30" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          </g>

          <circle className={s.bubble} cx="1292" cy="700" r="2.6" fill={BLUE} fillOpacity="0.7" />
          <circle className={s.bubble} cx="1316" cy="702" r="2" fill={BLUE} fillOpacity="0.6" style={{ animationDelay: "-3.2s" }} />
        </g>

        {/* 近景：铁架台 + 酸式滴定管 + 250 mL 锥形瓶（酚酞粉红） */}
        <g className={s.near}>
          <path d="M40 704H520" fill="none" stroke={INK} strokeOpacity={0.32} strokeWidth={1.2} />

          {/* 铁架台：底座 + 立杆 + 滴定管夹 + 螺丝 */}
          <g stroke={INK} strokeOpacity={S} strokeWidth={2.4} fill="none" strokeLinecap="round">
            <path d="M118 704H266" />
            <path d="M190 704V200" />
            <path d="M190 252H262" />
          </g>
          <circle cx="190" cy="252" r="5" fill="#fff" fillOpacity={0.5} stroke={INK} strokeOpacity={S} strokeWidth={1.4} />
          <circle cx="190" cy="686" r="4" fill="#fff" fillOpacity={0.5} stroke={INK} strokeOpacity={S} strokeWidth={1.4} />

          {/* 酸式滴定管：管身 + 液柱 + 活塞 + 横柄 + 尖嘴 + 刻度 */}
          <g transform="translate(200 232) scale(0.9)">
            <path d="M45 14 H75 L73 20 V300 H47 V20 Z" {...GLASS} />
            <path d="M45 14 H75 L73 20 V300 H47 V20 Z" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path className={s.buretteLiquid} d="M47.5 214 H72.5 V300 H47.5 Z" fill={WATER} fillOpacity={0.42} />
            <rect x="38" y="300" width="44" height="16" rx="4" {...GLASS} />
            <rect x="38" y="300" width="44" height="16" rx="4" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M56 316 H64 V320 L62 342 H58 L56 320 Z" {...GLASS} />
            <path d="M56 316 H64 V320 L62 342 H58 L56 320 Z" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <rect x="87" y="303.5" width="12" height="9" rx="2" {...GLASS} />
            <rect x="87" y="303.5" width="12" height="9" rx="2" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <line x1="82" y1="308" x2="87" y2="308" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <line x1="51" y1="30" x2="51" y2="292" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
            <g stroke={INK} strokeOpacity={S} strokeWidth={0.9}>
              {Array.from({ length: 11 }, (_, i) => (
                <line key={i} x1="62" y1={52 + i * 24.4} x2="72.3" y2={52 + i * 24.4} />
              ))}
            </g>
          </g>

          {/* 250 mL 锥形瓶：酚酞粉红，坐在台面上 */}
          <g transform="translate(196 583) scale(0.66)">
            <Glass d={FLASK_BODY} highlight="M67 72 L44 164" />
            <line x1="60" y1="16" x2="100" y2="16" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path className={s.liquidSway} d={FLASK_LIQUID} fill={PINK} fillOpacity={0.52} />
            <circle className={s.bubble} cx="60" cy="166" r="3" fill="#fff" fillOpacity="0.85" />
            <circle className={s.bubble} cx="98" cy="170" r="2.4" fill="#fff" fillOpacity={0.8} style={{ animationDelay: "-2.6s" }} />
          </g>

          {/* 滴定管尖嘴落下的粉色液滴，落入锥形瓶液面 */}
          <circle
            className={s.drop}
            cx="254"
            cy="548"
            r="3.4"
            fill={PINK}
            fillOpacity="0.9"
            style={{ "--drip-rise": "112px" } as CSSProperties}
          />

          {/* 称量瓶：矮筒 + 磨口盖 */}
          <g transform="translate(320 654)" stroke={INK} strokeOpacity={S} strokeWidth={W} fill="#fff" fillOpacity={0.5}>
            <path d="M0 0 V50 H46 V0" />
            <path d="M-5 -8 H51 V0 H-5 Z" />
            <line x1="10" y1="4" x2="10" y2="46" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* 坩埚 + 盖 */}
          <g transform="translate(392 660)" stroke={INK} strokeOpacity={S} strokeWidth={W} fill="#fff" fillOpacity={0.5}>
            <path d="M0 4 L6 44 H44 L50 4 Z" />
            <path d="M-6 4 C8 -7 42 -7 56 4" fill="none" />
            <line x1="6" y1="10" x2="9" y2="38" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* 洗瓶：瓶身 + 磨口盖 + 弯管 */}
          <g transform="translate(444 627) scale(0.82)">
            <path d="M0 0 V94 H44 V0" {...GLASS} />
            <path d="M0 0 V94 H44 V0" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M-6 0 H50 V-8 H-6 Z" {...GLASS} />
            <path d="M-6 0 H50 V-8 H-6 Z" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M22 -8 V-26 C22 -38 38 -36 38 -52" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={1.6} strokeLinecap="round" />
            <line x1="5" y1="8" x2="5" y2="86" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
      </svg>

      {/* ---------------- 窄屏版 ---------------- */}
      <svg className={`${s.layer} ${s.mobi}`} viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        <g className={s.far}>
          <path d="M0 792H390" fill="none" stroke={INK} strokeOpacity={0.18} strokeWidth={1} />
          <g transform="translate(18 26) scale(0.78)">
            <Glass d={VOLUMETRIC_BODY} highlight="M74 26 V60" />
            <path d="M66 10 H94 V18 H66 Z" {...GLASS} />
            <path d="M66 10 H94 V18 H66 Z" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <line x1="66" y1="40" x2="94" y2="40" stroke={INK} strokeOpacity={0.75} strokeWidth={1.6} />
            <path d={VOLUMETRIC_LIQUID} fill={PURPLE} fillOpacity={0.42} />
          </g>
          <g transform="translate(272 40)">
            <rect x="0" y="0" width="26" height="150" {...GLASS} />
            <path d="M0 0 V150 M26 0 V150" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M-5 0 H31" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M1 66 H25 V150 H1 Z" fill={WATER} fillOpacity={0.44} />
          </g>
        </g>

        <g className={s.near}>
          <path d="M0 792H390" fill="none" stroke={INK} strokeOpacity={0.32} strokeWidth={1.2} />

          {/* 锥形瓶：酚酞粉红 */}
          <g transform="translate(34 664) scale(0.7)">
            <Glass d={FLASK_BODY} highlight="M67 72 L44 164" />
            <line x1="60" y1="16" x2="100" y2="16" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path className={s.liquidSway} d={FLASK_LIQUID} fill={PINK} fillOpacity={0.52} />
          </g>

          {/* 烧杯：硫酸铜淡蓝 */}
          <g transform="translate(176 661) scale(0.66)">
            <path d={BEAKER_BODY} {...GLASS} />
            <path d={BEAKER_BODY} fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <ellipse cx="80" cy="41" rx="54" ry="7.5" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d={BEAKER_LIQUID} fill={BLUE} fillOpacity={0.45} />
            <line x1="31.5" y1="56" x2="31.5" y2="180" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* 量筒 */}
          <g transform="translate(292 690)">
            <rect x="0" y="0" width="22" height="102" {...GLASS} />
            <path d="M0 0 V102 M22 0 V102" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M-4 0 H26" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
          </g>

          <circle className={s.dropSm} cx="94" cy="600" r="3" fill={PINK} fillOpacity="0.9" />
        </g>
      </svg>
    </div>
  );
}
