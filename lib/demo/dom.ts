/**
 * 演示导演的 DOM 小工具：跨 realm 定位、真实鼠标事件、折叠区展开、可点等待、结果条读色。
 *
 * 注意：元素来自 iframe 的 realm，**不能** 用 `instanceof HTMLElement`
 * 判断（父窗口的构造函数识别不了子窗口元素），一律按 tagName / 属性鸭子类型判断。
 */

import { wait, type RingTone } from "./cursor";

export function findTarget(doc: Document, id: string): HTMLElement | null {
  const el = doc.querySelector(`[data-demo-id="${CSS.escape(id)}"]`);
  if (!el || (el as Node).nodeType !== 1) return null;
  return el as HTMLElement;
}

/** 派发一串真实鼠标事件，React 的合成事件也能收到 */
export function realClick(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const view = el.ownerDocument.defaultView;
  const base = { bubbles: true, cancelable: true, clientX: x, clientY: y, view };
  el.dispatchEvent(new PointerEvent("pointerdown", { ...base, pointerId: 1, isPrimary: true }));
  el.dispatchEvent(new MouseEvent("mousedown", base));
  el.dispatchEvent(new PointerEvent("pointerup", { ...base, pointerId: 1, isPrimary: true }));
  el.dispatchEvent(new MouseEvent("mouseup", base));
  el.dispatchEvent(new MouseEvent("click", base));
}

/** 写值也要派发 input/change，否则受控组件不会更新 */
export function setValue(el: HTMLElement, value: string): void {
  const input = el as HTMLInputElement;
  const proto = Object.getPrototypeOf(input) as object;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  const own = Object.getOwnPropertyDescriptor(input, "value");
  if (desc?.set && !own) desc.set.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/** 目标可能在折叠的「其他做法」里：逐级展开 details，否则量不到坐标、也点不到 */
export function revealAncestors(el: HTMLElement): void {
  let node: HTMLElement | null = el;
  while (node) {
    if (node.tagName === "DETAILS" && !(node as HTMLDetailsElement).open) {
      (node as HTMLDetailsElement).open = true;
    }
    node = node.parentElement;
  }
}

function isDisabled(el: HTMLElement): boolean {
  const button = el as HTMLButtonElement;
  if (button.disabled === true) return true;
  return el.getAttribute("aria-disabled") === "true";
}

/** 等目标出现、可见、可点（disabled 的按钮点不动，必须等它变可用） */
export async function waitClickable(
  doc: Document,
  id: string,
  timeout: number,
): Promise<HTMLElement | null> {
  const deadline = Date.now() + timeout;
  let last: HTMLElement | null = null;
  for (;;) {
    const el = findTarget(doc, id);
    if (el) {
      last = el;
      revealAncestors(el);
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && !isDisabled(el)) return el;
    }
    if (Date.now() >= deadline) return last;
    await wait(80);
  }
}

/** 结果条钩子：demo-feedback-ok-N / demo-feedback-fail-N，据此决定目标反馈环的颜色 */
export function feedbackTone(doc: Document): RingTone {
  const nodes = doc.querySelectorAll('[data-demo-id^="demo-feedback-"]');
  for (const node of nodes) {
    const id = node.getAttribute("data-demo-id") ?? "";
    if (id.includes("-fail-")) return "fail";
    if (id.includes("-ok-")) return "ok";
  }
  return "river";
}
