"use client";

/**
 * 倾倒动画（画在实验台 SVG 里，坐标就是 viewBox 单位）。
 *
 * 为什么不在 HTML 层做：HTML 层只能用 `getBoundingClientRect()` 反推落点，
 * 一旦 SVG 缩放/换 viewBox 就对不准 —— 用户 2026-10-22 报的「倒的时候口没对准落点」
 * 就是这么来的。现在瓶子、液柱、涟漪全在同一个 viewBox 里按器皿几何算：
 *
 *   瓶口坐标 = 器皿中轴 x、瓶口椭圆 y 上方 GAP（用户口径：口必须对着容器的口）
 *   液柱     = 从**瓶口**竖直落到**液面**（空器皿就落到内底），起点终点都是算出来的
 *
 * 时序（总 1150ms，POUR_MS=1160，动作播完才 dispatch）：
 *   0    松手点 → 器皿瓶口上方（280ms 贝塞尔弧线）
 *   280  瓶身绕瓶口倾到 150°（140ms）—— 瓶口不动，液柱起点因此稳定
 *   400  液柱从瓶口长出来（220ms 长满，不碰 height，只动 scaleY）
 *   470  落点涟漪（300ms）
 *   560  液面按 scaleY 从原液位涨到新液位（340ms）
 *   950  瓶子淡出（200ms）
 */

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { SCENE_VESSELS } from "@/lib/scene/palette";
import type { VesselOffset } from "./actions/geometry";
import { ReagentBottle, BOTTLE_MOUTH, BOTTLE_SIZE } from "./reagent-bottle";
import { CENTER_X, MOUTH_Y, VESSEL_SCALE, levelTopY, liquidBox, mouthOf } from "./vessels/vessel-geometry";

/** 参考实现里的水色（drag-pour: LIQUID.water）—— 近白的试剂用它，才像水不像金属。 */
export const STREAM_WATER = "#A9D3E8";

/**
 * 液柱色：
 * - 近白试剂（蒸馏水 #DCE9F2、无色溶液）→ 参考实现的水蓝 STREAM_WATER。
 *   往墨里压会压成灰（#9AA7B0），在白玻璃里像一根金属棒。
 * - 有色试剂 → 本色往墨里压一点（.18），纸白底上才看得见。
 */
export function streamColor(hex: string): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  const luminance = (0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]) / 255;
  if (luminance > 0.86) return STREAM_WATER;
  const ink = [74, 87, 104];
  const rgb = channels.map((channel, index) => Math.round(channel * 0.82 + ink[index] * 0.18));
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}


/** 一次倾倒要倒进哪台器皿（release 是**视口坐标**，用来让瓶子从松手处起飞）。
 *  结构上兼容 `PourState`：直接把 flow.pour 传进来即可，不用再造一个对象
 *  （对象每次渲染换新引用会让动画重启）。 */
export type BenchPourIntent = {
  key: number;
  vesselId?: string | null;
  color: string;
  release?: { x: number; y: number } | null;
};

const FLY_MS = 280;
const TILT_MS = 140;
const STREAM_START = 400;
const STREAM_GROW = 220;
const STREAM_FADE = 950;
const STREAM_FADE_MS = 140;
const RIPPLE_START = 470;
const RIPPLE_MS = 300;
const RISE_START = 560;
const RISE_MS = 340;
const BOTTLE_FADE_START = 950;
const BOTTLE_FADE_MS = 200;

/** 瓶口停在器皿瓶口上方多少（viewBox 单位）。够高才看得见液柱。 */
const MOUTH_GAP = 42;
/** 倾倒角：口朝下、瓶身在斜上方（±150° 就是「手从这一侧把瓶子倒过来」）。 */
const TILT_DEG = 150;

export type BenchPourProps = {
  pour: BenchPourIntent | null;
  /** 倒之前的液位 / 倒完的液位（0..1）。 */
  fromLevel: number;
  toLevel: number;
  svgRef: RefObject<SVGSVGElement | null>;
  offsets: Readonly<Record<string, VesselOffset>>;
  /** 版面整体左移多少（右栏收边时器皿会一起左移，倾倒几何要跟着走） */
  layoutDx?: number;
  /** 液面涨到位（动画落地）：这一刻才把液位记账 +1。 */
  onLanded?: (vesselId: string) => void;
};

export function BenchPour({ pour, fromLevel, toLevel, svgRef, offsets, layoutDx = 0, onLanded }: BenchPourProps) {
  const rootRef = useRef<SVGGElement | null>(null);
  const onLandedRef = useRef(onLanded);
  useEffect(() => {
    onLandedRef.current = onLanded;
  }, [onLanded]);
  const key = pour?.key ?? 0;

  useLayoutEffect(() => {
    if (!pour?.vesselId) return;
    const vesselId = pour.vesselId;
    const svg = svgRef.current;
    const root = rootRef.current;
    if (!svg || !root) {
      const skip = window.setTimeout(() => onLandedRef.current?.(vesselId), 0);
      return () => window.clearTimeout(skip);
    }

    const vessel = SCENE_VESSELS.find((item) => item.id === pour.vesselId);
    if (!vessel) return;
    const offset = offsets[vessel.id] ?? { dx: 0, dy: 0 };
    const scale = VESSEL_SCALE[vessel.kind];
    const baseX = vessel.x + offset.dx + layoutDx;
    const baseY = vessel.y + offset.dy;
    const mouth = mouthOf(vessel.kind);
    const box = liquidBox(vessel.kind);
    const cx = baseX + CENTER_X[vessel.kind] * scale;
    const mouthY = baseY + MOUTH_Y[vessel.kind] * scale;
    const surfaceFrom = baseY + levelTopY(box, fromLevel) * scale;
    const surfaceTo = baseY + levelTopY(box, toLevel) * scale;
    const innerBottom = baseY + box.bottom * scale;

    // 视口 ↔ viewBox：瓶子从手指松开的地方起飞，接上拖动影子
    const matrix = svg.getScreenCTM();
    const toUser = (x: number, y: number) => {
      if (!matrix) return { x: cx, y: mouthY - MOUTH_GAP };
      const point = svg.createSVGPoint();
      point.x = x;
      point.y = y;
      const mapped = point.matrixTransform(matrix.inverse());
      return { x: mapped.x, y: mapped.y };
    };
    const toScreen = (x: number, y: number) => {
      if (!matrix) return { x: cx, y: mouthY };
      const point = svg.createSVGPoint();
      point.x = x;
      point.y = y;
      const mapped = point.matrixTransform(matrix);
      return { x: mapped.x, y: mapped.y };
    };
    const screenMouth = toScreen(cx, mouthY);
    // 没有松手点（URL 事件 / 演示脚本直接触发）时，从器皿正上方起手
    const release = pour.release ?? { x: screenMouth.x, y: screenMouth.y - 120 };
    const start = toUser(release.x, release.y - 34);

    // 手从左来 → 瓶身留在左侧、瓶口朝右下（实测：CSS rotate 正角度在 SVG 里是顺时针，
    // 屏上看到的瓶身在「旋转正方向」的那一侧，所以左来取负）。
    const tilt = screenMouth.x >= release.x ? -TILT_DEG : TILT_DEG;
    const target = { x: cx, y: mouthY - MOUTH_GAP };
    const landY = Math.max(target.y + 26, fromLevel > 0.004 ? surfaceFrom : Math.min(innerBottom - 6, surfaceTo));

    const bottle = root.querySelector<SVGGElement>("[data-pour-bottle]");
    const streams = Array.from(root.querySelectorAll<SVGRectElement>("[data-pour-stream]"));
    const ripple = root.querySelector<SVGEllipseElement>("[data-pour-ripple]");
    const liquid = svg.querySelector<SVGGElement>(`[data-vessel-liquid="${vessel.id}"]`);
    const anims: Animation[] = [];

    // ---- 液柱：三条细流从瓶口竖直落到落点（照 drag-pour 的做法） ----
    // 一条粗水柱在纸白底上像根玻璃棒；三条细流错开 70ms 落下，才像水。
    if (streams.length) {
      const width = Math.max(2, Math.min(2.8, mouth.rx * scale * 0.08));
      const total = STREAM_FADE + STREAM_FADE_MS - STREAM_START;
      streams.forEach((stream, index) => {
        const offset = (index - 1) * 2;
        const end = index === 1 ? landY : landY - 3;
        stream.setAttribute("x", String(cx + offset - width / 2));
        stream.setAttribute("y", String(target.y + 2));
        stream.setAttribute("width", String(width));
        stream.setAttribute("height", String(Math.max(6, end - target.y - 2)));
        anims.push(
          stream.animate(
            [
              { transform: "scaleY(0.04)", opacity: 0.85, offset: 0 },
              { transform: "scaleY(1)", opacity: 0.92, offset: STREAM_GROW / total },
              { transform: "scaleY(1)", opacity: 0.92, offset: (STREAM_FADE - STREAM_START) / total },
              { transform: "scaleY(1)", opacity: 0, offset: 1 },
            ],
            {
              duration: total,
              delay: STREAM_START + index * 70,
              easing: "cubic-bezier(.3,.02,.66,1)",
              // forwards：delay（400+70i）里别把 0% 帧的 0.85 不透明度先亮出来 ——
              // 不然刚松手，瓶口就挂着一小截水滴（2026-10-23 逐帧抓到）。基础态 opacity 0 在 JSX 里给。
              fill: "forwards",
            },
          ),
        );
      });
    }

    // ---- 涟漪：落在液面/内底上 ----
    if (ripple) {
      const rx = Math.max(6, mouth.rx * scale * 0.72);
      ripple.setAttribute("cx", String(cx));
      ripple.setAttribute("cy", String(landY));
      ripple.setAttribute("rx", String(rx));
      ripple.setAttribute("ry", String(Math.max(2, rx * 0.18)));
      anims.push(
        ripple.animate(
          [
            { transform: "scale(0.35)", opacity: 0.8 },
            { transform: "scale(1)", opacity: 0 },
          ],
          { duration: RIPPLE_MS, delay: RIPPLE_START, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" },
        ),
      );
    }

    // ---- 液面上升：整组按底边 scaleY，fromLevel → toLevel ----
    if (liquid) {
      const heightFrom = (box.bottom - levelTopY(box, fromLevel)) * scale;
      const heightTo = (box.bottom - levelTopY(box, toLevel)) * scale;
      const k = heightTo > 0.5 ? Math.max(0, Math.min(1, heightFrom / heightTo)) : 0;
      anims.push(
        liquid.animate(
          [
            { transform: `scaleY(${k.toFixed(3)})` },
            { transform: "scaleY(1)" },
          ],
          { duration: RISE_MS, delay: RISE_START, easing: "cubic-bezier(.23,1,.32,1)", fill: "both" },
        ),
      );
    }

    // ---- 瓶子：松手处 → 器皿瓶口上方 → 倾倒 → 淡出 ----
    if (bottle) {
      const move = `translate(${target.x.toFixed(1)}px, ${target.y.toFixed(1)}px)`;
      const dx = target.x - start.x;
      const arc = {
        x: start.x + dx * 0.55,
        y: Math.min(start.y, target.y) - 46,
      };
      anims.push(
        bottle.animate(
          [
            { transform: `translate(${start.x.toFixed(1)}px, ${start.y.toFixed(1)}px) rotate(0deg)`, opacity: 1 },
            { transform: `translate(${arc.x.toFixed(1)}px, ${arc.y.toFixed(1)}px) rotate(${tilt * 0.2}deg)`, opacity: 1, offset: 0.55 },
            { transform: `${move} rotate(${tilt * 0.28}deg)`, opacity: 1 },
          ],
          { duration: FLY_MS, easing: "cubic-bezier(.25,.85,.35,1)", fill: "both" },
        ),
      );
      anims.push(
        bottle.animate(
          [
            { transform: `${move} rotate(${tilt * 0.28}deg)`, opacity: 1 },
            { transform: `${move} rotate(${tilt}deg)`, opacity: 1 },
          ],
          { duration: TILT_MS, delay: FLY_MS, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" },
        ),
      );
      anims.push(
        bottle.animate(
          [
            { transform: `${move} rotate(${tilt}deg)`, opacity: 1 },
            { transform: `translate(${(target.x + tilt * 0.12).toFixed(1)}px, ${(target.y - 14).toFixed(1)}px) rotate(${tilt}deg)`, opacity: 0 },
          ],
          { duration: BOTTLE_FADE_MS, delay: BOTTLE_FADE_START, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" },
        ),
      );
    }

    root.style.visibility = "visible";

    // 液面涨到位再记账：setTimeout 里的 setState 是异步的（不在 effect 里同步 setState）
    const landed = window.setTimeout(() => onLandedRef.current?.(vessel.id), RISE_START + RISE_MS + 40);

    return () => {
      window.clearTimeout(landed);
      anims.forEach((anim) => anim.cancel());
    };
  }, [key, pour, fromLevel, toLevel, offsets, svgRef, layoutDx]);

  if (!pour?.vesselId) return null;

  return (
    <g ref={rootRef} data-bench-pour={pour.key} aria-hidden="true" style={{ visibility: "hidden" }}>
      <defs>
        <linearGradient id={`pourStream-${pour.key}`} x1="0" y1="0" x2="0" y2="1">
          {/* 上段是「看得见的水」，进入器皿后淡下去（玻璃里过深的水柱会像一根玻璃棒） */}
          <stop offset="0%" stopColor={streamColor(pour.color)} stopOpacity="0.95" />
          <stop offset="34%" stopColor={streamColor(pour.color)} stopOpacity="0.85" />
          <stop offset="72%" stopColor={streamColor(pour.color)} stopOpacity="0.5" />
          <stop offset="100%" stopColor={streamColor(pour.color)} stopOpacity="0.18" />
        </linearGradient>
      </defs>
      {/* 液柱：transform-origin 在顶端，scaleY 从瓶口往下长 */}
      {/* 三条细流：纸白底上浅色试剂（蒸馏水 #DCE9F2）要压深一档才看得见（见 streamColor） */}
      {[0, 1, 2].map((index) => (
        <rect
          key={index}
          data-pour-stream
          fill={`url(#pourStream-${pour.key})`}
          style={{ transformBox: "fill-box", transformOrigin: "50% 0", opacity: 0 }}
        />
      ))}
      {/* 落点涟漪：初始 opacity 0 —— 涟漪在 delay（470ms）里不能先亮着，
          否则瓶子还在飞、水面还没出水花，杯里先挂着一圈小椭圆（2026-10-23 逐帧抓到的）。
          fill 用 forwards 而不是 both：both 会把 0% 关键帧的 opacity .8 提前铺满整个 delay。 */}
      <ellipse
        data-pour-ripple
        fill="none"
        stroke="var(--canvas-glass-line)"
        strokeWidth={1.4}
        style={{ transformBox: "fill-box", transformOrigin: "50% 50%", opacity: 0 }}
      />
      {/* 瓶子：绕**瓶口**旋转，所以口永远压在算出来的落点上 */}
      <g data-pour-bottle style={{ transformBox: "view-box", transformOrigin: "0 0" }}>
        <g transform={`translate(${-BOTTLE_MOUTH.x} ${-BOTTLE_MOUTH.y})`}>
          <ReagentBottle color={pour.color} width={BOTTLE_SIZE.w} height={BOTTLE_SIZE.h} />
        </g>
      </g>
    </g>
  );
}
