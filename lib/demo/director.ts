import { DemoCursor, attachDemoFrame, wait } from "./cursor";
import type { DemoScript, DemoStep, DirectorHooks, DirectorState } from "./types";

/** 每种动作的默认停顿 */
const DEFAULT_MS: Record<DemoStep["kind"], number> = {
  caption: 1600,
  move: 460,
  click: 560,
  type: 420,
  wait: 800,
  scroll: 620,
  highlight: 900,
};

function findTarget(doc: Document, id: string): HTMLElement | null {
  const el = doc.querySelector(`[data-demo-id="${CSS.escape(id)}"]`);
  return el instanceof HTMLElement ? el : null;
}

/** 派发一串真实鼠标事件，React/Vue 的合成事件都能收到 */
function realClick(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const base = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: el.ownerDocument.defaultView };
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
        this.hooks.onStep?.(i, script.steps[i]);
        await this.runStep(script.steps[i]);
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

    if (step.text) this.hooks.onCaption?.(step.text);

    if (step.kind === "caption" || step.kind === "wait") {
      await wait(step.ms ?? DEFAULT_MS[step.kind]);
      return;
    }

    if (!step.target) {
      await wait(step.ms ?? DEFAULT_MS[step.kind]);
      return;
    }

    const el = findTarget(doc, step.target);
    if (!el) {
      // 找不到就跳过，绝不抛错中断整场演示
      // eslint-disable-next-line no-console
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
      await cursor.moveTo(el, step.ms ?? 320);
      const prev = el.style.outline;
      el.style.outline = "2px solid var(--river-700)";
      el.style.outlineOffset = "2px";
      await wait(step.ms ?? DEFAULT_MS.highlight);
      el.style.outline = prev;
      return;
    }

    await cursor.moveTo(el, step.ms ?? DEFAULT_MS.move);

    if (step.kind === "click") {
      await cursor.press();
      realClick(el);
      await wait(step.ms ?? DEFAULT_MS.click);
      return;
    }

    if (step.kind === "type") {
      el.focus();
      setValue(el, step.value ?? "");
      await wait(step.ms ?? DEFAULT_MS.type);
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
