/** 演示脚本的最小单元。所有定位都靠 data-demo-id，不依赖 CSS 选择器。 */
export type DemoStepKind =
  | "caption"
  | "move"
  | "click"
  | "type"
  | "wait"
  | "scroll"
  | "highlight"
  | "waitFor";

export type DemoStep = {
  kind: DemoStepKind;
  /** data-demo-id 的值；move/click/type/scroll/highlight/waitFor 必填 */
  target?: string;
  /**
   * 字幕文案。
   * - caption：操作前的导语，立即播；
   * - 其它动作：操作与结果反馈之后才播（先操作，后解说），见 docs/演示钩子.md §3。
   */
  text?: string;
  /** type 动作写入的值 */
  value?: string;
  /** 等待毫秒；不填按动作类型取默认值 */
  ms?: number;
  /** waitFor 的最长等待毫秒（默认 3000），超时后不报错、直接继续 */
  timeout?: number;
};

export type DemoScript = {
  id: string;
  title: string;
  /** 被演示的页面路径（iframe src） */
  page: string;
  steps: DemoStep[];
};

export type DirectorState = "idle" | "playing" | "paused" | "done";

export type DirectorHooks = {
  onStep?: (index: number, step: DemoStep) => void;
  onCaption?: (text: string) => void;
  onState?: (state: DirectorState) => void;
};
