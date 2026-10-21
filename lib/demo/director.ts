import { DemoCursor, attachDemoFrame, wait, type RingTone } from "./cursor";
import type { DemoScript, DemoStep, DirectorHooks, DirectorState } from "./types";

/** 每种动作的默认停顿（动作完成之后的停顿时长） */
const DEFAULT_MS: Record<DemoStep["kind"], number> = {
  caption: 1600,
  move: 460,
  click: 560,
  type: 420,
  wait: 800,
  scroll: 620,
  highlight: 900,
  waitFor: 3000,
};

/** 点击后等结果条渲染出来的固定观察窗；够 React 一帧 + 结果条入场 260ms */
const FEEDBACK_WINDOW_MS = 380;

function findTarget(doc: Document, id: string): HTMLElement | null {
  const el = doc.querySelector(`[data-demo-id="${CSS.escape(id)}"]`);
  // 元素来自 iframe 的 realm，不能用 instanceof HTMLElement（父窗口的构造函数识别不了）
  if (!el || (el as Node).nodeType !== 1) return null;
  return el as HTMLElement;
}

/** 派发一串真实鼠标事件，React 的合成事件也能收到 */
function realClick(el: HTMLElement): void {
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
function setValue(el: HTMLElement, value: string): void {
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
function revealAncestors(el: HTMLElement): void {
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
async function waitClickable(doc: Document, id: string, timeout: number): Promise<HTMLElement | null> {
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
function feedbackTone(doc: Document): RingTone {
  const nodes = doc.querySelectorAll('[data-demo-id^="demo-feedback-"]');
  for (const node of nodes) {
    const id = node.getAttribute("data-demo-id") ?? "";
    if (id.includes("-fail-")) return "fail";
    if (id.includes("-ok-")) return "ok";
  }
  return "river";
}

/**
 * 演示导演：按脚本在被演示页面上走一遍。
 * 只负责"演"，不含任何业务逻辑——业务仍由被演示页面自己的状态机处理。
 */
export class DemoDirector {
  private doc: Document | null = null;
  private cursor: DemoCursor | null = null;
  private detachFrame: (() => void) | null = null;
  private state: DirectorState = "idle";
  private cancelled = false;
  private paused = false;
  private hooks: DirectorHooks;

  constructor(hooks: DirectorHooks = {}) {
    this.hooks = hooks;
  }

  getState(): DirectorState {
    return this.state;
  }

  private setState(s: DirectorState): void {
    this.state = s;
    this.hooks.onState?.(s);
  }

  async play(doc: Document, script: DemoScript): Promise<void> {
    this.stop();
    this.doc = doc;
    this.cancelled = false;
    this.paused = false;
    this.cursor = new DemoCursor(doc);
    this.detachFrame = attachDemoFrame(doc);
    this.setState("playing");

    try {
      for (let i = 0; i < script.steps.length; i++) {
        if (this.cancelled) break;
        await this.gate();
        if (this.cancelled) break;
        const step = script.steps[i];
        this.hooks.onStep?.(i, step);
        await this.runStep(step);
        // 时序规则：先操作、后解说。动作步骤的字幕在动作与结果反馈之后才播。
        if (step.text && step.kind !== "caption" && step.kind !== "wait") {
          this.hooks.onCaption?.(step.text);
        }
      }
    } finally {
      if (!this.cancelled) this.setState("done");
      this.cleanup();
    }
  }

  /** 暂停时在这里挂住，恢复后继续 */
  private async gate(): Promise<void> {
    while (this.paused && !this.cancelled) await wait(80);
  }

  private async runStep(step: DemoStep): Promise<void> {
    const doc = this.doc;
    const cursor = this.cursor;
    if (!doc || !cursor) return;

    // caption / wait 是纯旁白，先说再做
    if (step.text && (step.kind === "caption" || step.kind === "wait")) {
      this.hooks.onCaption?.(step.text);
    }

    if (step.kind === "caption" || step.kind === "wait") {
      await wait(step.ms ?? DEFAULT_MS[step.kind]);
      return;
    }

    if (!step.target) {
      await wait(step.ms ?? DEFAULT_MS[step.kind]);
      return;
    }

    if (step.kind === "waitFor") {
      // 等结果条/下一步卡片出现再继续：不抢跑（拖拽后的 700ms 动画也在这里被吸收）
      const waited = await waitClickable(doc, step.target, step.timeout ?? DEFAULT_MS.waitFor);
      if (!waited) console.warn(`[demo] 等不到 data-demo-id=${step.target}`);
      if (step.ms) await wait(step.ms);
      return;
    }

    const el = await waitClickable(doc, step.target, 1200);
    if (!el) {
      // 找不到就跳过，绝不抛错中断整场演示
      console.warn(`[demo] 缺少 data-demo-id=${step.target}，已跳过`);
      await wait(200);
      return;
    }

    if (step.kind === "scroll") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      await wait(step.ms ?? DEFAULT_MS.scroll);
      return;
    }

    if (step.kind === "highlight") {
      await cursor.moveTo(el, 320);
      await cursor.outline(el, "river", step.ms ?? DEFAULT_MS.highlight);
      return;
    }

    // 点击类用固定 320ms 位移，避免长距离移动把整场演示拖慢
    await cursor.moveTo(el, step.kind === "click" ? 320 : (step.ms ?? DEFAULT_MS.move));

    if (step.kind === "type") {
      el.focus();
      setValue(el, step.value ?? "");
      await wait(step.ms ?? DEFAULT_MS.type);
      return;
    }

    if (step.kind === "click") {
      await cursor.outline(el, "river", 180); // 目标高亮：按下之前先亮一圈
      await cursor.press(); // 按下反馈：光标缩放 + ripple
      realClick(el);
      await wait(FEEDBACK_WINDOW_MS); // 等结果条出现，再按结果给目标反馈环
      const rect = el.getBoundingClientRect();
      cursor.ringAt(rect.left + rect.width / 2, rect.top + rect.height / 2, feedbackTone(doc));
      const rest = (step.ms ?? DEFAULT_MS.click) - FEEDBACK_WINDOW_MS;
      if (rest > 0) await wait(rest);
    }
  }

  pause(): void {
    if (this.state !== "playing") return;
    this.paused = true;
    this.setState("paused");
  }

  resume(): void {
    if (this.state !== "paused") return;
    this.paused = false;
    this.setState("playing");
  }

  stop(): void {
    this.cancelled = true;
    this.paused = false;
    this.cleanup();
    if (this.state !== "idle") this.setState("idle");
  }

  private cleanup(): void {
    this.cursor?.destroy();
    this.cursor = null;
    this.detachFrame?.();
    this.detachFrame = null;
  }
}
