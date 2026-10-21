import { DemoCursor, attachDemoFrame, wait } from "./cursor";
import { feedbackTone, realClick, setValue, waitClickable } from "./dom";
import { runDrag } from "./drag";
import type { DemoScript, DemoStep, DirectorHooks, DirectorState } from "./types";

/** 每种动作的默认停顿（动作完成之后的停顿时长） */
const DEFAULT_MS: Record<DemoStep["kind"], number> = {
  caption: 1600,
  move: 460,
  click: 560,
  drag: 900,
  type: 420,
  wait: 800,
  scroll: 620,
  highlight: 900,
  waitFor: 3000,
};

/** 点击位移随机区间（用户 2026-10-22：固定 320ms 太机械） */
const MOVE_MIN_MS = 400;
const MOVE_MAX_MS = 800;
/** 按下之前先悬停，模拟人"看准了再点" */
const HOVER_MIN_MS = 200;
const HOVER_MAX_MS = 400;
/** 点击/拖拽后等结果条渲染出来的观察窗；够 React 一帧 + 结果条入场 260ms */
const FEEDBACK_WINDOW_MS = 380;
/** 动作解说播出后按住不动，别让下一条 caption 立刻把它顶掉（字幕要能读完） */
const CAPTION_HOLD_MS = 900;

const rand = (min: number, max: number): number => min + Math.round(Math.random() * (max - min));

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
          await wait(CAPTION_HOLD_MS);
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
      // 等结果条/下一步卡片出现再继续：不抢跑（拖拽后的 700ms 倒入动画也在这里被吸收）
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

    // 点击 / 拖拽位移 400~800ms 随机（固定 320ms 太机械）
    await cursor.moveTo(
      el,
      step.kind === "click" || step.kind === "drag" ? rand(MOVE_MIN_MS, MOVE_MAX_MS) : (step.ms ?? DEFAULT_MS.move),
    );

    if (step.kind === "type") {
      el.focus();
      setValue(el, step.value ?? "");
      await wait(step.ms ?? DEFAULT_MS.type);
      return;
    }

    if (step.kind === "drag") {
      const toEl = step.to ? await waitClickable(doc, step.to, 1200) : null;
      if (!toEl) {
        console.warn(`[demo] 拖拽缺少落点 data-demo-id=${step.to}，已跳过`);
        await wait(200);
        return;
      }
      await runDrag(cursor, doc, el, toEl);
      // 投放后 700ms 才 dispatch（倒入动画播完），这里等够再读取结果条
      await wait(FEEDBACK_WINDOW_MS + 340);
      const rect = toEl.getBoundingClientRect();
      cursor.ringAt(rect.left + rect.width / 2, rect.top + rect.height / 2, feedbackTone(doc));
      const rest = (step.ms ?? DEFAULT_MS.drag) - FEEDBACK_WINDOW_MS - 340;
      if (rest > 0) await wait(rest);
      return;
    }

    if (step.kind === "click") {
      await wait(rand(HOVER_MIN_MS, HOVER_MAX_MS)); // 悬停：看准了再按
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
