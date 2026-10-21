/**
 * 演示光标：在被演示页面的 document 里插一个 SVG 箭头 + 波纹/高亮环。
 * 只动 transform/opacity，符合 STYLE §5 动效规则。
 *
 * 注意：元素来自 iframe 的 realm，**不能** 用 `instanceof HTMLElement`
 * 判断（父窗口的构造函数识别不了子窗口元素），一律按 tagName / 属性鸭子类型判断。
 */

const CURSOR_ID = "chemlab-demo-cursor";
const FX_ATTR = "data-demo-fx";

const ARROW_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M4 2.5 L4 19.2 L8.6 14.8 L11.4 21.2 L14.6 19.6 L11.9 13.4 L18.4 13.2 Z"
    fill="#16202C" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

/** 高亮/反馈环的三种色：河大蓝=位移，jade=做对，danger=出事 */
const RING_TONE: Record<RingTone, string> = {
  river: "#23307F",
  ok: "#0F7B6C",
  fail: "#B42318",
};

export type RingTone = "river" | "ok" | "fail";

export class DemoCursor {
  private doc: Document;
  private el: HTMLDivElement | null = null;

  constructor(doc: Document) {
    this.doc = doc;
  }

  /** 懒创建，避免演示开始前污染页面 */
  private ensure(): HTMLDivElement {
    const existing = this.doc.getElementById(CURSOR_ID);
    if (existing && existing.tagName === "DIV") {
      this.el = existing as HTMLDivElement;
      return this.el;
    }
    const el = this.doc.createElement("div");
    el.id = CURSOR_ID;
    el.setAttribute(FX_ATTR, "cursor");
    el.innerHTML = ARROW_SVG;
    el.setAttribute("aria-hidden", "true");
    Object.assign(el.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "24px",
      height: "24px",
      zIndex: "2147483000",
      pointerEvents: "none",
      transform: "translate3d(40px, 40px, 0)",
      transition: "transform 460ms cubic-bezier(0.23, 1, 0.32, 1)",
      filter: "drop-shadow(0 2px 6px rgba(0,0,0,.35))",
      willChange: "transform",
    } satisfies Partial<CSSStyleDeclaration>);
    this.doc.body.appendChild(el);
    this.el = el;
    return el;
  }

  show(): void {
    this.ensure().style.opacity = "1";
  }

  hide(): void {
    if (this.el) this.el.style.opacity = "0";
  }

  /** 把光标移到元素中心；ms 为过渡时长 */
  async moveTo(target: Element, ms = 460): Promise<void> {
    const el = this.ensure();
    el.style.transitionDuration = `${ms}ms`;
    const rect = target.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2 - 4);
    const y = Math.round(rect.top + rect.height / 2 - 4);
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1)`;
    await wait(ms);
  }

  /** 按下时的视觉反馈：缩一下 + 一圈波纹（按下 ripple） */
  async press(ms = 140): Promise<void> {
    const el = this.ensure();
    el.style.transform = el.style.transform.replace(/scale\([^)]*\)/, "scale(0.86)");
    await wait(ms);
    el.style.transform = el.style.transform.replace(/scale\([^)]*\)/, "scale(1)");
    const rect = el.getBoundingClientRect();
    this.ringAt(rect.left + 8, rect.top + 10, "river");
  }

  /**
   * 拖拽的"按住态"：光标保持 scale(.98) 并压出一点阴影，
   * 与普通点击的 scale(.86) 区分开（红队 2026-10-22 要求拖拽被抓起的质感）。
   */
  setHeld(held: boolean): void {
    const el = this.ensure();
    el.style.transform = el.style.transform.replace(/scale\([^)]*\)/, held ? "scale(0.98)" : "scale(1)");
    el.style.filter = held
      ? "drop-shadow(0 6px 12px rgba(16, 24, 40, 0.35))"
      : "drop-shadow(0 2px 3px rgba(16, 24, 40, 0.25))";
  }

  /** 按视口坐标移动光标（拖拽路径逐点用）；duration 设为 0 表示立即定位 */
  moveToPoint(x: number, y: number, ms = 0): void {
    const el = this.ensure();
    el.style.transitionDuration = `${ms}ms`;
    el.style.transform = `translate3d(${Math.round(x - 4)}px, ${Math.round(y - 4)}px, 0) ${
      el.style.transform.includes("scale(0.98)") ? "scale(0.98)" : "scale(1)"
    }`;
  }

  /** 拖拽轨迹上的一个小点（可见轨迹），lifeMs 后自动清理 */
  trailAt(x: number, y: number, lifeMs = 420): void {
    const doc = this.doc;
    const dot = doc.createElement("div");
    dot.setAttribute(FX_ATTR, "trail");
    Object.assign(dot.style, {
      position: "fixed",
      left: `${Math.round(x)}px`,
      top: `${Math.round(y)}px`,
      width: "6px",
      height: "6px",
      marginLeft: "-3px",
      marginTop: "-3px",
      borderRadius: "9999px",
      background: "rgba(29, 78, 137, 0.45)",
      zIndex: "2147482998",
      pointerEvents: "none",
      opacity: "0.75",
      transition: `opacity ${lifeMs}ms ease-out, transform ${lifeMs}ms ease-out`,
    } satisfies Partial<CSSStyleDeclaration>);
    doc.body.appendChild(dot);
    dot.getBoundingClientRect();
    dot.style.opacity = "0";
    dot.style.transform = "scale(0.4)";
    setTimeout(() => dot.remove(), lifeMs + 40);
  }

  /** 目标高亮 / 结果反馈环：以元素中心为圆心扩散一圈 */
  ringAt(left: number, top: number, tone: RingTone = "river", size = 18): void {
    const doc = this.doc;
    const ring = doc.createElement("div");
    ring.setAttribute(FX_ATTR, "ring");
    Object.assign(ring.style, {
      position: "fixed",
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      width: `${size}px`,
      height: `${size}px`,
      marginLeft: `${-size / 2}px`,
      marginTop: `${-size / 2}px`,
      borderRadius: "9999px",
      border: `2px solid ${RING_TONE[tone]}`,
      opacity: "0.9",
      zIndex: "2147482999",
      pointerEvents: "none",
      transform: "scale(0.4)",
      transition: "transform 420ms cubic-bezier(0.23, 1, 0.32, 1), opacity 420ms ease-out",
      willChange: "transform, opacity",
    } satisfies Partial<CSSStyleDeclaration>);
    doc.body.appendChild(ring);
    ring.getBoundingClientRect();
    ring.style.transform = "scale(5.2)";
    ring.style.opacity = "0";
    setTimeout(() => ring.remove(), 480);
  }

  /** 在元素上套一圈高亮描边（目标高亮），duration 后复原 */
  async outline(target: Element, tone: RingTone = "river", ms = 260): Promise<void> {
    const style = (target as HTMLElement).style;
    const prev = style.outline;
    const prevOffset = style.outlineOffset;
    style.outline = `2px solid ${RING_TONE[tone]}`;
    style.outlineOffset = "2px";
    await wait(ms);
    style.outline = prev;
    style.outlineOffset = prevOffset;
  }

  destroy(): void {
    this.doc.getElementById(CURSOR_ID)?.remove();
    this.doc.querySelectorAll(`[${FX_ATTR}]`).forEach((node) => node.remove());
    this.el = null;
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 在被演示页面的 body 上插一条"正在演示"的呼吸边框，避免观众以为是真人操作 */
export function attachDemoFrame(doc: Document): () => void {
  const box = doc.createElement("div");
  box.setAttribute(FX_ATTR, "frame");
  box.setAttribute("aria-hidden", "true");
  Object.assign(box.style, {
    position: "fixed",
    inset: "0",
    border: "2px solid rgba(35,48,127,.55)",
    zIndex: "2147482000",
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>);
  doc.body.appendChild(box);
  return () => box.remove();
}
