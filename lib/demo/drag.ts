/**
 * 演示拖拽一段（用户 2026-10-22 定的口径）：
 *   抓取按住 180ms（scale .98）→ 贝塞尔路径每 32ms 一个 pointermove 并留可见轨迹
 *   → 落点吸附高亮 250ms → pointerup / drop。
 * 同时派发 HTML5 DnD（被演示页的器皿投加用的是原生 drag 接口），两条链路都走通。
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

export async function runDrag(
  cursor: DemoCursor,
  doc: Document,
  fromEl: HTMLElement,
  toEl: HTMLElement,
): Promise<void> {
  const from = centerOf(fromEl);
  const to = centerOf(toEl);

  // 1) 抓住：按住态 + pointerdown
  cursor.setHeld(true);
  fromEl.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      clientX: from.x,
      clientY: from.y,
      pointerId: 1,
      isPrimary: true,
      buttons: 1,
    }),
  );
  await wait(GRAB_MS);

  // 2) 原生 DnD 起步
  const dt = new DataTransfer();
  fromEl.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));

  // 3) 贝塞尔跟随：每 32ms 一个 pointermove + 轨迹点
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const points = Math.max(10, Math.min(28, Math.round(dist / 34)));
  for (let i = 1; i <= points; i++) {
    const p = bezierAt(from, to, i / points);
    cursor.moveToPoint(p.x, p.y, 0);
    if (i % 2 === 0) cursor.trailAt(p.x, p.y);
    const hit = doc.elementFromPoint(p.x, p.y) ?? toEl;
    hit.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        clientX: p.x,
        clientY: p.y,
        pointerId: 1,
        isPrimary: true,
        buttons: 1,
      }),
    );
    toEl.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
    await wait(PATH_TICK_MS);
  }

  // 4) 落点吸附高亮
  await cursor.outline(toEl, "river", SNAP_MS);

  // 5) 松手：drop → pointerup → dragend
  toEl.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  toEl.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      clientX: to.x,
      clientY: to.y,
      pointerId: 1,
      isPrimary: true,
    }),
  );
  fromEl.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt }));
  cursor.setHeld(false);
}
