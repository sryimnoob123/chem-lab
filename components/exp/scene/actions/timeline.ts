/**
 * 动作时间线（可复用底层的动画执行器）
 *
 * 一条动作 = 若干 beat：`{ sel, frames, duration, delay }`。
 * 全部走 WAAPI（element.animate），不引第三方动画库：
 *   - 只动 transform / opacity，不逐帧改布局；
 *   - fill: both，动作播完停在末帧，卸下时不会闪回；
 *   - prefers-reduced-motion 下返回 0，调用方立刻出结果（文案与判定照常）。
 */

export const EASE_OUT = "cubic-bezier(.23, 1, .32, 1)";
export const EASE_IN_OUT = "cubic-bezier(.4, 0, .2, 1)";
export const EASE_BACK = "cubic-bezier(.34, 1.56, .64, 1)";

export type Beat = {
  /** 层内选择器，命中多个时按 stagger 依次延迟 */
  sel: string;
  frames: Keyframe[];
  duration: number;
  delay?: number;
  stagger?: number;
  easing?: string;
};

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** 播一组 beat，返回整条动作的时长（ms）。root 不存在时返回 0。 */
export function playBeats(root: Element | null, beats: readonly Beat[]): number {
  if (!root) return 0;
  let total = 0;
  for (const beat of beats) {
    const nodes = Array.from(root.querySelectorAll(beat.sel));
    nodes.forEach((node, index) => {
      const delay = (beat.delay ?? 0) + (beat.stagger ?? 0) * index;
      // fill:both 让元素停在末帧，动作结束前不会跳回初态
      node.animate(beat.frames, {
        duration: beat.duration,
        delay,
        easing: beat.easing ?? EASE_OUT,
        fill: "both",
      });
      total = Math.max(total, delay + beat.duration);
    });
  }
  return total;
}
