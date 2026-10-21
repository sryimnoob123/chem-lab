import s from "./login-scene.module.css";
import {
  at,
  BEAKER_BODY,
  BEAKER_LIQUID,
  BLUE,
  FLASK_BODY,
  FLASK_LIQUID,
  GLASS,
  Glass,
  INK,
  PINK,
  PURPLE,
  S,
  VOLUMETRIC_BODY,
  VOLUMETRIC_LIQUID,
  W,
  WATER,
  vars,
} from "./login-scene-kit";

/** 桌面版背景（1440×900）：远景容量瓶/量筒/烧杯/漏斗，近景铁架台/滴定管/锥形瓶。 */
export function DeskScene() {
  return (
    <svg className={`${s.layer} ${s.desk}`} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      {/* 远景：容量瓶（淡紫）+ 量筒（水色）+ 烧杯（淡蓝）+ 漏斗，共用台面 y=704 */}
      <g className={s.far}>
        <g className={s.decor}>
          <path d="M960 704H1440" fill="none" stroke={INK} strokeOpacity={0.18} strokeWidth={1} />
        </g>

        <g className={s.vessel} transform="translate(992 526) scale(0.95)">
          <Glass d={VOLUMETRIC_BODY} highlight="M74 26 V60" i={2} />
          <g className={s.sketchIn} style={at(2)}>
            <path d="M66 10 H94 V18 H66 Z" {...GLASS} />
            <path d="M66 10 H94 V18 H66 Z" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <line x1="66" y1="40" x2="94" y2="40" stroke={INK} strokeOpacity={0.75} strokeWidth={1.6} />
          </g>
          <path className={s.sketchIn} style={at(2)} d={VOLUMETRIC_LIQUID} fill={PURPLE} fillOpacity={0.42} />
        </g>

        <g className={s.vessel} transform="translate(1146 482)">
          <g className={s.sketchIn} style={at(3)}>
            <rect x="0" y="0" width="30" height="222" {...GLASS} />
          </g>
          <path
            className={s.draw}
            style={at(3)}
            d="M0 0 V222 M30 0 V222"
            pathLength={1}
            fill="none"
            stroke={INK}
            strokeOpacity={S}
            strokeWidth={W}
          />
          <g className={s.sketchIn} style={at(3)}>
            <path d="M-6 0 H36" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <g stroke={INK} strokeOpacity={0.55} strokeWidth={0.9}>
              {[44, 82, 120, 158, 196].map((y) => (
                <line key={y} x1="0" y1={y} x2="11" y2={y} />
              ))}
            </g>
            <path d="M1 104 H29 V222 H1 Z" fill={WATER} fillOpacity={0.44} />
            <line x1="4" y1="10" x2="4" y2="212" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>

        <g className={s.vessel} transform="translate(1214 568) scale(0.72)">
          <g className={s.sketchIn} style={at(3)}>
            <path d={BEAKER_BODY} {...GLASS} />
          </g>
          <path
            className={s.draw}
            style={at(3)}
            d={BEAKER_BODY}
            pathLength={1}
            fill="none"
            stroke={INK}
            strokeOpacity={S}
            strokeWidth={W}
          />
          <g className={s.sketchIn} style={at(3)}>
            <ellipse cx="80" cy="41" rx="54" ry="7.5" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d={BEAKER_LIQUID} fill={BLUE} fillOpacity={0.45} />
            <line x1="31.5" y1="56" x2="31.5" y2="180" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>

        {/* 漏斗 + 滤纸锥，立在台面上 */}
        <g className={s.vessel} transform="translate(1352 633) scale(0.82)">
          <g className={s.sketchIn} style={at(3)}>
            <path d="M-42 -46 H42 L6 6 H-6 Z" {...GLASS} />
            <path d="M-42 -46 H42 L6 6 H-6 Z" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M-32 -46 L-3 6 M32 -46 L3 6" fill="none" stroke={INK} strokeOpacity="0.45" strokeWidth="0.9" />
            <path d="M-4 6 V86 M4 6 V86" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M-36 -42 L-30 -30" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
      </g>

      {/* 近景：铁架台 + 酸式滴定管 + 250 mL 锥形瓶（酚酞粉红） */}
      <g className={s.near}>
        <g className={s.decor}>
          <path d="M40 704H520" fill="none" stroke={INK} strokeOpacity={0.32} strokeWidth={1.2} />
        </g>

        {/* 铁架台：底座 + 立杆 + 滴定管夹 + 螺丝 */}
        <g className={s.vessel}>
          <g
            className={s.sketchIn}
            style={at(0)}
            stroke={INK}
            strokeOpacity={S}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          >
            <path d="M118 704H266" />
            <path d="M190 704V200" />
            <path d="M190 252H262" />
          </g>
          <g className={s.sketchIn} style={at(0)}>
            <circle cx="190" cy="252" r="5" fill="#fff" fillOpacity={0.5} stroke={INK} strokeOpacity={S} strokeWidth={1.4} />
            <circle cx="190" cy="686" r="4" fill="#fff" fillOpacity={0.5} stroke={INK} strokeOpacity={S} strokeWidth={1.4} />
          </g>
        </g>

        {/* 酸式滴定管：管身 + 液柱 + 活塞 + 横柄 + 尖嘴 + 刻度 */}
        <g className={s.vessel} transform="translate(200 232) scale(0.9)">
          <g className={s.sketchIn} style={at(0)}>
            <path d="M45 14 H75 L73 20 V300 H47 V20 Z" {...GLASS} />
          </g>
          <path
            className={s.draw}
            style={at(0)}
            d="M45 14 H75 L73 20 V300 H47 V20 Z"
            pathLength={1}
            fill="none"
            stroke={INK}
            strokeOpacity={S}
            strokeWidth={W}
          />
          <path className={s.buretteLiquid} style={at(0)} d="M47.5 214 H72.5 V300 H47.5 Z" fill={WATER} fillOpacity={0.42} />
          <g className={s.sketchIn} style={at(0)}>
            <rect x="38" y="300" width="44" height="16" rx="4" {...GLASS} />
            <rect x="38" y="300" width="44" height="16" rx="4" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M56 316 H64 V320 L62 342 H58 L56 320 Z" {...GLASS} />
            <path d="M56 316 H64 V320 L62 342 H58 L56 320 Z" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <rect x="87" y="303.5" width="12" height="9" rx="2" {...GLASS} />
            <rect x="87" y="303.5" width="12" height="9" rx="2" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <line x1="82" y1="308" x2="87" y2="308" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <line x1="51" y1="30" x2="51" y2="292" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
            <g stroke={INK} strokeOpacity={S} strokeWidth={0.9}>
              {Array.from({ length: 11 }, (_, k) => (
                <line key={k} x1="62" y1={52 + k * 24.4} x2="72.3" y2={52 + k * 24.4} />
              ))}
            </g>
          </g>
        </g>

        {/* 250 mL 锥形瓶：酚酞粉红，坐在台面上 */}
        <g className={s.vessel} transform="translate(196 583) scale(0.66)">
          <Glass d={FLASK_BODY} highlight="M67 72 L44 164" i={1} />
          <line className={s.sketchIn} style={at(1)} x1="60" y1="16" x2="100" y2="16" stroke={INK} strokeOpacity={S} strokeWidth={W} />
          <path className={s.liquid} style={at(1)} d={FLASK_LIQUID} fill={PINK} fillOpacity={0.52} />
          <circle className={s.bubble} cx="60" cy="166" r="3" fill="#fff" fillOpacity="0.85" />
          <circle
            className={s.bubble}
            cx="98"
            cy="170"
            r="2.4"
            fill="#fff"
            fillOpacity="0.8"
            style={vars({ "--phase": "2.6s" })}
          />
        </g>

        {/* 液滴（双滴错开 0.6s）+ 液面落点涟漪：同为 1.8s 周期 */}
        <g className={s.decor}>
          <circle
            className={s.drop}
            cx="254"
            cy="548"
            r="3.4"
            fill={PINK}
            fillOpacity="0.9"
            style={vars({ "--drip-rise": "112px" })}
          />
          <circle
            className={s.drop}
            cx="254"
            cy="548"
            r="3"
            fill={PINK}
            fillOpacity="0.7"
            style={vars({ "--drip-rise": "112px", "--phase": "0.6s" })}
          />
          <circle className={s.ripple} cx="254" cy="660" r="4" fill="none" stroke={PINK} strokeWidth="1.6" />
          <circle
            className={s.ripple}
            cx="254"
            cy="660"
            r="4"
            fill="none"
            stroke={PINK}
            strokeWidth="1.4"
            style={vars({ "--phase": "0.6s" })}
          />
        </g>

        {/* 称量瓶：矮筒 + 磨口盖 */}
        <g className={s.vessel} transform="translate(320 654)">
          <g
            className={s.sketchIn}
            style={at(2)}
            stroke={INK}
            strokeOpacity={S}
            strokeWidth={W}
            fill="#fff"
            fillOpacity={0.5}
          >
            <path d="M0 0 V50 H46 V0" />
            <path d="M-5 -8 H51 V0 H-5 Z" />
            <line x1="10" y1="4" x2="10" y2="46" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>

        {/* 坩埚 + 盖 */}
        <g className={s.vessel} transform="translate(392 660)">
          <g
            className={s.sketchIn}
            style={at(2)}
            stroke={INK}
            strokeOpacity={S}
            strokeWidth={W}
            fill="#fff"
            fillOpacity={0.5}
          >
            <path d="M0 4 L6 44 H44 L50 4 Z" />
            <path d="M-6 4 C8 -7 42 -7 56 4" fill="none" />
            <line x1="6" y1="10" x2="9" y2="38" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>

        {/* 洗瓶：瓶身 + 磨口盖 + 弯管 */}
        <g className={s.vessel} transform="translate(444 627) scale(0.82)">
          <g className={s.sketchIn} style={at(3)}>
            <path d="M0 0 V94 H44 V0" {...GLASS} />
            <path d="M0 0 V94 H44 V0" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M-6 0 H50 V-8 H-6 Z" {...GLASS} />
            <path d="M-6 0 H50 V-8 H-6 Z" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path
              d="M22 -8 V-26 C22 -38 38 -36 38 -52"
              fill="none"
              stroke={INK}
              strokeOpacity={S}
              strokeWidth={1.6}
              strokeLinecap="round"
            />
            <line x1="5" y1="8" x2="5" y2="86" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </svg>
  );
}
