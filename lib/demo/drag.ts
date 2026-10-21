/**
 * 演示拖拽一段（用户 2026-10-22 定的口径）：
 *   抓取按住 180ms（scale .98）→ 贝塞尔路径每 32ms 一个 pointermove 并留可见轨迹
 *   → 落点吸附高亮 250ms → pointerup。
 *
 * 全程只用 pointerdown / pointermove / pointerup 真实事件链：
 * UI 已改成 pointer 拖拽（`scene-stage.tsx` 的 `onPointerDown/Move/Up`），
 * 原生 HTML5 DragEvent 在真实浏览器里本来也伪造不出来，所以这里不再派发 dragstart/drop。
 *
 * 事件一律派发到「按下的那个元素」：UI 的监听挂在试剂按钮上，
 * 而落点是靠 pointerup 的坐标（elementFromPoint）判断的，不依赖事件目标。
 */

import { wait, type DemoCursor } from "./cursor";

/** 抓取按住、路径节拍、落点吸附 */
const GRAB_MS = 180;
const PATH_TICK_MS = 32;
const SNAP_MS = 250;

function centerOf(el: Element): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** 二次贝塞尔：起手先微微上抬，像人把东西拿起来再送过去 */
function bezierAt(from: { x: number; y: number }, to: { x: number; y: number }, t: number) {
  const cx = (from.x + to.x) / 2;
  const lift = Math.min(120, Math.abs(to.x - from.x) * 0.25 + 40);
  const cy = Math.min(from.y, to.y) - lift;
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * cx + t * t * to.x,
    y: u * u * from.y + 2 * u * t * cy + t * t * to.y,
  };
}

/** 合成一个 pointer 事件（mouse 主指针，带按键状态，UI 才认得出是拖拽中） */
function pointerEvent(type: string, x: number, y: number, buttons: number): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
    isPrimary: true,
    pointerType: "mouse",
    buttons,
  });
}

export async function runDrag(
  cursor: DemoCursor,
  doc: Document,
  fromEl: HTMLElement,
  toEl: HTMLElement,
): Promise<void> {
  const from = centerOf(fromEl);
  const to = centerOf(toEl);

  // 段 1 抓取：按住态 + pointerdown（buttons=1 表示左键按住）
  cursor.setHeld(true);
  fromEl.dispatchEvent(pointerEvent("pointerdown", from.x, from.y, 1));
  await wait(GRAB_MS);

  // 段 2 移动：贝塞尔路径跟随，每 32ms 一个 pointermove，每隔一个点留轨迹
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const points = Math.max(10, Math.min(28, Math.round(dist / 34)));
  for (let i = 1; i <= points; i++) {
    const p = bezierAt(from, to, i / points);
    cursor.moveToPoint(p.x, p.y, 0);
    if (i % 2 === 0) cursor.trailAt(p.x, p.y);
    // 派发给起点元素：UI 的 onPointerMove 挂在它身上；落区高亮由它自己 elementFromPoint 算
    fromEl.dispatchEvent(pointerEvent("pointermove", p.x, p.y, 1));
    await wait(PATH_TICK_MS);
  }

  // 段 3 落位：先在落点上给出高亮框，再松手（松手坐标就是落点）
  await cursor.outline(toEl, "river", SNAP_MS);
  fromEl.dispatchEvent(pointerEvent("pointerup", to.x, to.y, 0));
  cursor.setHeld(false);
}
