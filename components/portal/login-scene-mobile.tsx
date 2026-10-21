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
} from "./login-scene-kit";

/** 窄屏版背景（390×844）：上方远景容量瓶/量筒，下方近景锥形瓶/烧杯/量筒。 */
export function MobileScene() {
  return (
    <svg className={`${s.layer} ${s.mobi}`} viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
      <g className={s.far}>
        <g className={s.decor}>
          <path d="M0 792H390" fill="none" stroke={INK} strokeOpacity={0.18} strokeWidth={1} />
        </g>
        <g className={s.vessel} transform="translate(18 26) scale(0.78)">
          <Glass d={VOLUMETRIC_BODY} highlight="M74 26 V60" i={2} />
          <g className={s.sketchIn} style={at(2)}>
            <path d="M66 10 H94 V18 H66 Z" {...GLASS} />
            <path d="M66 10 H94 V18 H66 Z" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <line x1="66" y1="40" x2="94" y2="40" stroke={INK} strokeOpacity={0.75} strokeWidth={1.6} />
          </g>
          <path className={s.sketchIn} style={at(2)} d={VOLUMETRIC_LIQUID} fill={PURPLE} fillOpacity={0.42} />
        </g>
        <g className={s.vessel} transform="translate(272 40)">
          <g className={s.sketchIn} style={at(3)}>
            <rect x="0" y="0" width="26" height="150" {...GLASS} />
            <path d="M0 0 V150 M26 0 V150" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M-5 0 H31" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M1 66 H25 V150 H1 Z" fill={WATER} fillOpacity={0.44} />
          </g>
        </g>
      </g>

      <g className={s.near}>
        <g className={s.decor}>
          <path d="M0 792H390" fill="none" stroke={INK} strokeOpacity={0.32} strokeWidth={1.2} />
        </g>

        {/* 锥形瓶：酚酞粉红 */}
        <g className={s.vessel} transform="translate(34 664) scale(0.7)">
          <Glass d={FLASK_BODY} highlight="M67 72 L44 164" i={0} />
          <line className={s.sketchIn} style={at(0)} x1="60" y1="16" x2="100" y2="16" stroke={INK} strokeOpacity={S} strokeWidth={W} />
          <path className={s.liquid} style={at(0)} d={FLASK_LIQUID} fill={PINK} fillOpacity={0.52} />
        </g>

        {/* 烧杯：硫酸铜淡蓝 */}
        <g className={s.vessel} transform="translate(176 661) scale(0.66)">
          <g className={s.sketchIn} style={at(1)}>
            <path d={BEAKER_BODY} {...GLASS} />
          </g>
          <path
            className={s.draw}
            style={at(1)}
            d={BEAKER_BODY}
            pathLength={1}
            fill="none"
            stroke={INK}
            strokeOpacity={S}
            strokeWidth={W}
          />
          <g className={s.sketchIn} style={at(1)}>
            <ellipse cx="80" cy="41" rx="54" ry="7.5" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d={BEAKER_LIQUID} fill={BLUE} fillOpacity={0.45} />
            <line x1="31.5" y1="56" x2="31.5" y2="180" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>

        {/* 量筒 */}
        <g className={s.vessel} transform="translate(292 690)">
          <g className={s.sketchIn} style={at(3)}>
            <rect x="0" y="0" width="22" height="102" {...GLASS} />
            <path d="M0 0 V102 M22 0 V102" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
            <path d="M-4 0 H26" fill="none" stroke={INK} strokeOpacity={S} strokeWidth={W} />
          </g>
        </g>
      </g>
    </svg>
  );
}
