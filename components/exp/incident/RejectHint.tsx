"use client";

/**
 * RejectHint —— E1「拒收」提示（STYLE-20261021 §4.1）。
 *
 * 规格：目标上红色虚线框 1 次 + 240ms shake（motion.css 的 .ix-shake 由目标自己播）；
 * 本条提示 180ms 淡入（--pop），跟随目标定位（滚动/resize 时重测），三行文案固定：
 * ①错在哪 ②为什么 ③怎么改。文案由调用方从 steps/rules 取，组件不编化学解释。
 *
 * 实现：fixed 定位 + portal 到 body，避免被台面的 transform/overflow 裁掉；
 * 只动 opacity/transform；`prefers-reduced-motion` 下淡入改为瞬时，内容照常显示。
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import styles from "./incident.module.css";
import { sanitizeForStudents } from "./messages";
import { useIsClient } from "./use-is-client";

const ROW_KEYS = ["错在哪", "为什么", "怎么改"] as const;

export interface RejectHintProps {
  /** 是否显示；由工作台在拒收瞬间置 true，关闭时置 false */
  open: boolean;
  /** 固定三行：①错在哪（≤20 字）②为什么（机理/规范）③怎么改（一句动作） */
  lines: readonly [string, string, string];
  /** 被拒收的目标元素（推荐）：提示与虚线框跟随它定位 */
  anchorRef?: RefObject<HTMLElement | null>;
  /** 没有 anchorRef 时的视口坐标（如跟随光标） */
  point?: { x: number; y: number };
  /** 自动收起时长；0 表示不自动收（由 open 控制） */
  autoHideMs?: number;
  onDismiss?: () => void;
  demoId?: string;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const BUBBLE_W = 300;
const MARGIN = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function RejectHint({
  open,
  lines,
  anchorRef,
  point,
  autoHideMs = 2800,
  onDismiss,
  demoId,
}: RejectHintProps) {
  const mounted = useIsClient();
  const [rect, setRect] = useState<Rect | null>(null);
  const px = point?.x;
  const py = point?.y;

  const measure = useCallback(() => {
    const anchor = anchorRef?.current;
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
      return;
    }
    if (typeof px === "number" && typeof py === "number") {
      setRect({ left: px, top: py, width: 0, height: 0 });
      return;
    }
    setRect(null);
  }, [anchorRef, px, py]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  // 目标元素抖 240ms（motion.css 的 .ix-shake）；reduced-motion 下 motion.css 会静音。
  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef?.current;
    if (!anchor) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cls = "ix-shake";
    anchor.classList.remove(cls);
    anchor.getBoundingClientRect();
    anchor.classList.add(cls);
    const timer = window.setTimeout(() => anchor.classList.remove(cls), 260);
    return () => {
      window.clearTimeout(timer);
      anchor.classList.remove(cls);
    };
  }, [open, anchorRef]);

  // 自动收（工作台也可以一直保留到自己重做本步）
  useEffect(() => {
    if (!open || autoHideMs <= 0 || !onDismiss) return;
    const timer = window.setTimeout(onDismiss, autoHideMs);
    return () => window.clearTimeout(timer);
  }, [open, autoHideMs, onDismiss]);

  // Esc 收起；不抢焦点（提示非模态）
  useEffect(() => {
    if (!open || !onDismiss) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!mounted || !open) return null;

  const viewportW = typeof window === "undefined" ? 1024 : window.innerWidth;
  const viewportH = typeof window === "undefined" ? 768 : window.innerHeight;
  const hasRect = rect !== null;
  const left = hasRect
    ? clamp(rect.left + rect.width / 2 - BUBBLE_W / 2, MARGIN, Math.max(MARGIN, viewportW - BUBBLE_W - MARGIN))
    : MARGIN;
  const placeAbove = hasRect ? rect.top > viewportH * 0.42 : false;
  const top = hasRect ? (placeAbove ? rect.top - 12 : rect.top + rect.height + 12) : MARGIN;

  return createPortal(
    <div className={styles.rejectRoot} data-demo-id={demoId}>
      {hasRect && rect.width > 0 ? (
        <span
          className={styles.rejectFrame}
          aria-hidden="true"
          style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      ) : null}
      <div
        className={styles.rejectAnchor}
        data-placement={placeAbove ? "above" : "below"}
        style={{ left, top }}
      >
        <div className={styles.rejectBubble} role="status" aria-live="polite" aria-atomic="true">
          <span className={styles.rejectTag}>操作未被接受</span>
          {lines.map((text, index) => (
            <p key={ROW_KEYS[index]} className={styles.rejectLine}>
              <span className={styles.rejectKey}>{ROW_KEYS[index]}</span>
              <span>{sanitizeForStudents(text)}</span>
            </p>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
