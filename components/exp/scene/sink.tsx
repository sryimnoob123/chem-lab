"use client";

/**
 * 洗涤槽（2.5D 斜投影）。
 *
 * 用户 2026-10-22：实验里涉及洗杯子，就该有个洗槽；纯 2D 看不出效果。
 * 做法：斜投影的凹槽 —— 外沿梯形（台面切掉的洞）+ 槽内深色椭圆（看不见底，才有深度）
 * + 内壁渐变的左/右两块侧面 + 台上水龙头。不用任何 3D 库。
 *
 * 交互（每个器具都要能看出「可以操作」）：
 *   - hover：槽口描边加深 + 槽体微抬（scale 1.01）
 *   - 按下：scale(.97)
 *   - 有器皿被拖到槽口上方（highlight）：槽口高亮 + 「松手冲洗」提示
 *   - 点一下：龙头放水 1.6s（水流 + 涟漪），点完就有反馈
 */

import { useEffect, useRef, useState } from "react";
import styles from "./scene.module.css";

/** 槽体外沿尺寸（viewBox 单位）；bench-scene 的命中判定与之共用。 */
export const SINK_W = 156;
export const SINK_H = 92;
/** 斜投影的倾斜量：右下方向缩进，形成「往里凹」的观感 */
const SKEW = 18;
const DEPTH = 28;

/** 洗涤槽命中区：槽口再往外放宽一圈，拖拽时不必精确压在梯形里。 */
export function sinkHitTest(px: number, py: number, originX: number, originY: number): boolean {
  return (
    px > originX - 14 &&
    px < originX + SINK_W + 14 &&
    py > originY - 46 &&
    py < originY + SINK_H + 6
  );
}

interface SinkProps {
  /** 槽口左上角（viewBox 单位） */
  x: number;
  y: number;
  /** 正在冲水（拿着水龙头工具）：槽口出现水柱与涟漪 */
  running?: boolean;
  /** 有器皿拖到了槽口上方：槽口高亮，告诉学生「松手就洗」 */
  highlight?: boolean;
  onUse?: () => void;
}

export function Sink({ x, y, running = false, highlight = false, onUse }: SinkProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  /** 点一下放一下水：1.6s 后自己停，不需要父组件配合 */
  const [pulse, setPulse] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const flow = running || pulse;
  const startPulse = () => {
    setPulse(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPulse(false), 1600);
    onUse?.();
  };

  return (
    <g
      className={styles.sink}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      data-demo-id="demo-scene-sink"
      data-drop-kind="sink"
      data-hover={hovered ? "true" : "false"}
      data-pressed={pressed ? "true" : "false"}
      data-hot={highlight ? "true" : "false"}
      data-running={flow ? "true" : "false"}
      role="button"
      tabIndex={0}
      aria-label={highlight ? "洗涤槽：松手把器皿放进来冲洗" : "洗涤槽：把器皿拖进来冲洗，或点一下放水"}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        setPressed(true);
      }}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onClick={(event) => {
        event.stopPropagation();
        startPulse();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          startPulse();
        }
      }}
    >
      <g className={styles.sinkBody}>
        {/* 台面开孔（外沿） */}
        <path d={`M0 0 H${SINK_W} L${SINK_W - SKEW} ${DEPTH} H${SKEW} Z`} className={styles.sinkRim} />
        <defs>
          <linearGradient id="chemlab-sink-inner" x1="0" y1="0" x2="0" y2="1">
            {/* SVG 的 stop-color 不解析 rgba()，写成 rgba 会渲染成纯黑（2026-10-22 实测黑板），
                必须拆成 stop-color + stop-opacity */}
            <stop offset="0%" stopColor="#4a5768" stopOpacity={0.10} />
            <stop offset="55%" stopColor="#4a5768" stopOpacity={0.05} />
            <stop offset="100%" stopColor="#4a5768" stopOpacity={0.13} />
          </linearGradient>
          <linearGradient id="chemlab-sink-wall" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4a5768" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#4a5768" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        {/* 槽底（梯形，往里缩） */}
        <path
          d={`M${SKEW} ${DEPTH} H${SINK_W - SKEW} L${SINK_W - SKEW - 10} ${SINK_H} H${SKEW + 10} Z`}
          fill="var(--sink-basin)"
        />
        {/* 左右内壁 */}
        <path
          d={`M0 0 L${SKEW} ${DEPTH} L${SKEW + 10} ${SINK_H} L0 ${SINK_H - DEPTH} Z`}
          fill="var(--sink-wall)"
        />
        <path
          d={`M${SINK_W} 0 L${SINK_W - SKEW} ${DEPTH} L${SINK_W - SKEW - 10} ${SINK_H} L${SINK_W} ${SINK_H - DEPTH} Z`}
          fill="var(--sink-wall)"
          opacity={0.6}
        />
        {/* 落水口 */}
        <ellipse cx={SINK_W / 2} cy={SINK_H - 13} rx={9} ry={4} className={styles.sinkDrain} />
        {/* 水龙头：从槽后沿竖起，弯头朝下 */}
        <g className={styles.sinkFaucet}>
          <rect x={SINK_W - 34} y={-46} width={7} height={48} rx={3} className={styles.sinkPipe} />
          <path
            d={`M${SINK_W - 27} -40 q16 0 16 15 v8`}
            fill="none"
            className={styles.sinkPipe}
            strokeWidth={7}
            strokeLinecap="round"
          />
          <rect x={SINK_W - 46} y={-52} width={18} height={5} rx={2} className={styles.sinkPipe} />
        </g>
        {flow ? (
          <g className={styles.sinkWater}>
            <rect
              x={SINK_W - 30}
              y={-17}
              width={4}
              height={DEPTH + 18}
              rx={2}
              className={styles.sinkStream}
            />
            <ellipse cx={SINK_W - 28} cy={DEPTH + 6} rx={14} ry={4} className={styles.sinkRipple} />
            <ellipse
              cx={SINK_W - 28}
              cy={DEPTH + 6}
              rx={22}
              ry={6}
              className={styles.sinkRipple}
              opacity={0.5}
            />
          </g>
        ) : null}
        {/* 拖拽命中高亮：贴着槽口外沿的一圈实线 */}
        <path
          d={`M-8 -8 H${SINK_W + 8} L${SINK_W - SKEW + 5} ${DEPTH + 5} H${SKEW - 5} Z`}
          className={styles.sinkHotRing}
        />
      </g>
      <text className={styles.sinkLabel} x={SINK_W / 2} y={SINK_H + 20} textAnchor="middle">
        洗涤槽
      </text>
      {highlight ? (
        <g className={styles.sinkBadge} pointerEvents="none">
          <rect x={SINK_W / 2 - 44} y={-92} width={88} height={22} rx={11} />
          <text x={SINK_W / 2} y={-76} textAnchor="middle">
            松手冲洗
          </text>
        </g>
      ) : null}
    </g>
  );
}
