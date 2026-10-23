"use client";

/**
 * 台面工具导轨：画在实验台 SVG 里（同一个 viewBox），学生先点工具、再点器皿。
 *
 * 交互契约（用户 2026-10-22：卡片点一下就把整步做完，等于答题）：
 *   1. 点工具 → 工具抬起、进入「拿着」状态
 *   2. 点目标器皿 → onUseTool(toolId, vesselId)，由 workbench 决定执行哪个动作
 *   3. 点空白 → 放下工具
 *
 * 手感（每个器具都要有 hover / 按下 / 拖拽三种反馈）：
 *   - hover：抬起 5px + 描边变深（data-hover，指针为 fine 时才生效）
 *   - 按下：scale(.97)，30ms（data-pressed）
 *   - 拿着 / 拖动：抬得更高 + 投影（data-active / data-dragging），拖动时跟随指针
 *
 * 位置由 bench-scene 通过 area 传入（版面和器皿/洗涤槽同一套 layout），
 * 这里的 x/y 只在导轨内均分 —— 不再各画各的绝对坐标。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SCENE_TOOLS, type SceneTool, type SceneToolId } from "@/lib/scene/tools";
import styles from "./scene.module.css";

interface ToolTrayProps {
  /** 导轨底框（viewBox 单位） */
  area: { x: number; y: number; w: number; h: number };
  toolIds: readonly SceneToolId[];
  activeTool: SceneToolId | null;
  onSelectTool: (id: SceneToolId | null) => void;
  /** 工具落到器皿上（拖动松手 / 点选后点器皿） */
  onUseTool?: (tool: SceneToolId, vesselId: string) => void;
}

const VESSEL_SELECTOR = '[data-demo-id^="demo-scene-vessel-"]';

/** 托盘金属渐变 id：一台实验台只渲染一只托盘，固定 id 足够（不引 useId，免得 SSR/CSR 抖动）。 */
const TRAY_METAL_ID = "trayMetalFace";
const TRAY_EDGE_ID = "trayMetalEdge";

function art(tool: SceneTool, active: boolean) {
  const stroke = "rgba(74, 87, 104, 0.72)";
  const fill = "rgba(246, 247, 245, 0.94)";
  const accent = active ? "var(--river-700)" : stroke;

  switch (tool.id) {
    case "faucet":
      return (
        <g>
          {/* 竖管 + 横臂 + 出水口 */}
          <path d="M-9 -18 h10 v14 h18 v9 h-9 v-6 h-9 v10" fill="none" stroke={accent} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
          {/* 把手 */}
          <rect x={-16} y={-22} width={10} height={5} rx={2} fill={fill} stroke={accent} strokeWidth={1.6} />
          {/* 水滴 */}
          <path d="M10 12 q2.6 4 0 6 q-2.6 -2 0 -6" fill={active ? "var(--river-500)" : "rgba(74, 87, 104, 0.35)"} stroke="none" />
        </g>
      );
    case "brush":
      return (
        <g>
          <rect x={-3} y={-22} width={6} height={20} rx={3} fill={fill} stroke={accent} strokeWidth={1.8} />
          <path d="M-9 -2 h18 l-3 12 h-12 z" fill="rgba(120, 132, 148, 0.5)" stroke={accent} strokeWidth={1.6} strokeLinejoin="round" />
        </g>
      );
    case "wash-bottle":
      return (
        <g>
          <rect x={-8} y={-4} width={16} height={22} rx={5} fill="rgba(198, 226, 240, 0.75)" stroke={accent} strokeWidth={1.8} />
          <path d="M0 -4 v-10 q0 -4 5 -4 h6" fill="none" stroke={accent} strokeWidth={2.4} strokeLinecap="round" />
          <rect x={-5} y={-24} width={10} height={5} rx={2} fill={fill} stroke={accent} strokeWidth={1.4} />
        </g>
      );
    case "rod":
      return (
        <g>
          <rect x={-2} y={-24} width={4} height={46} rx={2} fill="rgba(226, 236, 244, 0.9)" stroke={accent} strokeWidth={1.4} />
          <circle cx={0} cy={21} r={3} fill={fill} stroke={accent} strokeWidth={1.2} />
        </g>
      );
    case "dropper":
      return (
        <g>
          <ellipse cx={0} cy={-16} rx={7} ry={8} fill="rgba(150, 165, 182, 0.65)" stroke={accent} strokeWidth={1.4} />
          <path d="M0 -8 v22 l-2.2 6 h4.4 z" fill="rgba(226, 236, 244, 0.9)" stroke={accent} strokeWidth={1.3} strokeLinejoin="round" />
        </g>
      );
    case "cloth":
      // 抹布：一块折角的布
      return (
        <g>
          <path d="M-16 -10 h30 l-4 22 h-26 z" fill="rgba(214, 224, 234, 0.85)" stroke={accent} strokeWidth={1.5} strokeLinejoin="round" />
          <path d="M-6 -10 l3 9 l-8 2" fill="none" stroke={accent} strokeWidth={1.1} opacity={0.6} />
        </g>
      );
    case "detergent":
      // 洗洁精：瓶身 + 压泵
      return (
        <g>
          <rect x={-8} y={-6} width={16} height={24} rx={4} fill="rgba(186, 226, 214, 0.8)" stroke={accent} strokeWidth={1.6} />
          <rect x={-4} y={-14} width={8} height={9} rx={2} fill={fill} stroke={accent} strokeWidth={1.3} />
          <path d="M-4 -14 h10" fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" />
        </g>
      );
    case "cylinder":
      // 量筒：细长筒 + 分度
      return (
        <g>
          <rect x={-7} y={-22} width={14} height={44} rx={3} fill="rgba(232, 240, 246, 0.9)" stroke={accent} strokeWidth={1.5} />
          <path d="M-3 -14 h5 M-3 -6 h5 M-3 2 h5 M-3 10 h5" stroke={accent} strokeWidth={0.9} opacity={0.75} />
          <rect x={-9} y={-24} width={18} height={4} rx={1.6} fill={fill} stroke={accent} strokeWidth={1.1} />
        </g>
      );
    case "pipette":
      // 移液管：细管 + 中部膨大球 + 刻度环
      return (
        <g>
          <rect x={-2} y={-24} width={4} height={16} fill="rgba(232, 240, 246, 0.9)" stroke={accent} strokeWidth={1.1} />
          <ellipse cx={0} cy={0} rx={7} ry={9} fill="rgba(226, 236, 244, 0.95)" stroke={accent} strokeWidth={1.3} />
          <rect x={-2} y={8} width={4} height={16} fill="rgba(232, 240, 246, 0.9)" stroke={accent} strokeWidth={1.1} />
          <path d="M-4 -18 h8" stroke={accent} strokeWidth={1.4} />
        </g>
      );
    case "bulb":
      // 洗耳球：胶球 + 尖嘴
      return (
        <g>
          <ellipse cx={0} cy={4} rx={13} ry={15} fill="rgba(176, 190, 204, 0.55)" stroke={accent} strokeWidth={1.5} />
          <path d="M0 -11 v-8 l-2 -6 h4 l-2 6" fill="rgba(226, 236, 244, 0.9)" stroke={accent} strokeWidth={1.2} strokeLinejoin="round" />
        </g>
      );
    default:
      return null;
  }
}

export function ToolTray({ area, toolIds, activeTool, onSelectTool, onUseTool }: ToolTrayProps) {
  /** 悬停是「进入/离开」级别的状态，不在拖动热路径上，可以留在 React 里。 */
  const [hovered, setHovered] = useState<SceneToolId | null>(null);
  /**
   * 一次按下→抬起的会话放在 ref 里（2026-10-22 修）：
   * 之前 pointerup 里读 React 的 dragging 状态判断「这是不是拖动」，
   * 快速点击时两次事件落在同一帧、状态还没重渲染 → 直接 return，工具永远拿不起来
   * （用户报「连玻璃棒都没有」就是这条）。ref 一定是最新的。
   *
   * 2026-10-22 性能体检：会话里还记了「按下时的基准位置」和「屏幕→SVG 的缩放」，
   * 拖动期间只改 DOM（dataset + style.transform），**一次 setState 都不发**。
   * 旧实现在每个 pointermove 里 setGhost(point)，一次拖动触发 50 次整块台面重渲染，
   * 帧时长 p95 33ms（实测）。
   */
  const sessionRef = useRef<{
    id: SceneToolId;
    el: SVGGElement;
    x: number;
    y: number;
    moved: boolean;
    base: { x: number; y: number };
    scale: { x: number; y: number };
  } | null>(null);
  /** 最近一次指针位置：rAF 里读，一帧只写一次 transform */
  const pointerRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef(0);
  /** 刚刚是一次拖动（不是点击）：用来吞掉拖动后的 click */
  const draggedRef = useRef(false);

  /** 一帧一次：把「指针位移」换算成 SVG 单位，写成 transform（不动 transform 属性）。 */
  const flush = useCallback(() => {
    frameRef.current = 0;
    const session = sessionRef.current;
    if (!session) return;
    const dx = (pointerRef.current.x - session.x) / (session.scale.x || 1);
    const dy = (pointerRef.current.y - session.y) / (session.scale.y || 1);
    session.el.style.transform = `translate(${(session.base.x + dx).toFixed(1)}px, ${(session.base.y + dy).toFixed(1)}px)`;
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    },
    [],
  );

  const tools = SCENE_TOOLS.filter((tool) => toolIds.includes(tool.id));
  if (tools.length === 0) return null;

  // 导轨内均分：工具少时不摊到两头，多时也不挤在一起
  const slot = Math.min(area.w / tools.length, 152);
  const startX = area.x + (area.w - slot * tools.length) / 2;
  const centerY = area.y + area.h / 2 - 6;
  const home = (index: number) => ({ x: startX + slot * (index + 0.5), y: centerY });

  return (
    <g className={styles.toolTray} data-demo-id="demo-tool-tray">
      {/* 金属托盘的两条渐变（B3）：面（竖向 hi→low）+ 盘口亮边（横向左亮右淡）。
          id 固定：一台实验台只有一个托盘。 */}
      <defs>
        <linearGradient id={TRAY_METAL_ID} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--canvas-metal-hi)" />
          <stop offset="38%" stopColor="var(--canvas-metal-mid)" />
          <stop offset="100%" stopColor="var(--canvas-metal-low)" />
        </linearGradient>
        <linearGradient id={TRAY_EDGE_ID} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--canvas-metal-edge)" stopOpacity="0.95" />
          <stop offset="55%" stopColor="var(--canvas-metal-edge)" stopOpacity="0.48" />
          <stop offset="100%" stopColor="var(--canvas-metal-edge)" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      {/* 导轨底：一只搪瓷托盘（不是一张 UI 卡片）——金属面走竖向渐变（上受光、下背光），
          上沿压一道白亮边读成盘口，下沿一道淡影把盘子「放在」台面上。
          渐变是静态填充，工具拖动时只有工具自己在动，托盘不重绘。 */}
      <rect
        data-metal="tray-base"
        x={area.x}
        y={area.y}
        width={area.w}
        height={area.h}
        rx={14}
        fill={`url(#${TRAY_METAL_ID})`}
        className={styles.toolTrayBase}
      />
      <line
        x1={area.x + 18}
        y1={area.y + 2.4}
        x2={area.x + area.w - 18}
        y2={area.y + 2.4}
        stroke={`url(#${TRAY_EDGE_ID})`}
        strokeWidth={1.6}
        strokeLinecap="round"
        aria-hidden="true"
      />
      <line
        x1={area.x + 18}
        y1={area.y + area.h - 2.4}
        x2={area.x + area.w - 18}
        y2={area.y + area.h - 2.4}
        stroke="var(--canvas-metal-seam)"
        strokeOpacity={0.16}
        strokeWidth={1.6}
        strokeLinecap="round"
        aria-hidden="true"
      />
      <rect
        x={area.x + 3}
        y={area.y + 3}
        width={area.w - 6}
        height={area.h - 6}
        rx={11}
        className={styles.toolTrayInset}
      />
      <line
        x1={area.x + 22}
        y1={area.y + area.h - 14}
        x2={area.x + area.w - 22}
        y2={area.y + area.h - 14}
        className={styles.toolTrayGroove}
      />
      {tools.map((tool, index) => {
        const active = activeTool === tool.id;
        const base = home(index);
        return (
          <g
            key={tool.id}
            transform={`translate(${base.x} ${base.y})`}
            className={styles.tool}
            data-active={active}
            data-hover={hovered === tool.id ? "true" : "false"}
            data-demo-id={`demo-tool-${tool.id}`}
            role="button"
            tabIndex={0}
            aria-label={`${tool.label}${active ? "（已拿起）" : "，可拖到器皿上"}`}
            aria-pressed={active}
            onPointerEnter={() => {
              // 拖动中不改悬停态：少一帧重渲染，也避免拖出托盘时状态打架
              if (sessionRef.current) return;
              setHovered(tool.id);
            }}
            onPointerLeave={() => {
              if (sessionRef.current) return;
              setHovered(null);
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
              const el = event.currentTarget as SVGGElement;
              el.setPointerCapture?.(event.pointerId);
              const ctm = el.ownerSVGElement?.getScreenCTM();
              sessionRef.current = {
                id: tool.id,
                el,
                x: event.clientX,
                y: event.clientY,
                moved: false,
                base,
                scale: { x: ctm?.a || 1, y: ctm?.d || 1 },
              };
              pointerRef.current = { x: event.clientX, y: event.clientY };
              // 按下态直接写属性：不 setState（这一帧不用重渲染任何东西）
              el.dataset.pressed = "true";
              // 注意：这里**不能**调 onSelectTool —— 抬起时还会 toggle，
              // 按下就选中等于「选中又取消」，工具永远拿不起来（2026-10-22 实测）。
            }}
            onPointerMove={(event) => {
              const session = sessionRef.current;
              if (!session || session.id !== tool.id) return;
              if (!session.moved) {
                if (Math.hypot(event.clientX - session.x, event.clientY - session.y) < 4) return;
                session.moved = true;
                // 拿起态：属性切换交给 CSS（transition 在 [data-dragging] 里已关掉）
                session.el.dataset.dragging = "true";
                delete session.el.dataset.pressed;
              }
              event.stopPropagation();
              pointerRef.current = { x: event.clientX, y: event.clientY };
              if (frameRef.current) return;
              frameRef.current = window.requestAnimationFrame(flush);
            }}
            onPointerUp={(event) => {
              const session = sessionRef.current;
              if (!session || session.id !== tool.id) return;
              event.stopPropagation();
              sessionRef.current = null;
              if (frameRef.current) {
                window.cancelAnimationFrame(frameRef.current);
                frameRef.current = 0;
              }
              session.el.style.transform = "";
              delete session.el.dataset.dragging;
              delete session.el.dataset.pressed;
              draggedRef.current = session.moved;
              if (!session.moved) {
                // 位移太小 = 一次点击：走「点选后再点器皿」
                onSelectTool(active ? null : tool.id);
                return;
              }
              // 被拖的元素就在指针下，所以取整叠命中再挑器皿（松手只判一次）
              const stack = document.elementsFromPoint(event.clientX, event.clientY);
              const hit = stack.find((element) => element.closest(VESSEL_SELECTOR));
              const vessel = hit?.closest(VESSEL_SELECTOR)?.getAttribute("data-demo-id");
              const vesselId = vessel?.replace("demo-scene-vessel-", "");
              if (vesselId) onUseTool?.(tool.id, vesselId);
              onSelectTool(null);
            }}
            onPointerCancel={() => {
              const session = sessionRef.current;
              sessionRef.current = null;
              if (frameRef.current) {
                window.cancelAnimationFrame(frameRef.current);
                frameRef.current = 0;
              }
              if (session) {
                session.el.style.transform = "";
                delete session.el.dataset.dragging;
                delete session.el.dataset.pressed;
              }
            }}
            onClick={(event) => {
              event.stopPropagation();
              // 拖动 / 刚在 pointerup 里处理过的点击：吞掉，避免又 toggle 回去
              if (draggedRef.current) {
                draggedRef.current = false;
                return;
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectTool(active ? null : tool.id);
              }
            }}
          >
            {/* 抬起 / 按下只作用于这一层：外层 <g> 的 transform 是拖拽位置（属性），
                不能被 CSS transform 覆盖，否则工具会跳回原点。 */}
            <g className={styles.toolArt}>
              {/* 接地影：工具立在托盘里，不是浮在图标层上（两层椭圆＝柔和，不用 filter） */}
              <ellipse cx={0} cy={22} rx={14} ry={3.2} fill="rgba(57, 72, 90, 0.07)" />
              <ellipse cx={0} cy={22} rx={8} ry={2.2} fill="rgba(57, 72, 90, 0.07)" />
              {/* 命中区（比图形大一圈，触控友好） */}
              <rect x={-30} y={-42} width={60} height={80} fill="transparent" />
              {art(tool, active)}
              <text className={styles.toolLabel} x={0} y={38} textAnchor="middle">
                {tool.label}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}
