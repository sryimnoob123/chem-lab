/** 演示脚本的最小单元。所有定位都靠 data-demo-id，不依赖 CSS 选择器。 */
export type DemoStepKind = "caption" | "move" | "click" | "type" | "wait" | "scroll" | "highlight";

export type DemoStep = {
  kind: DemoStepKind;
  /** data-demo-id 的值；move/click/type/scroll/highlight 必填 */
  target?: string;
  /** 字幕文案（caption 必填；其它动作也可带，作为旁白） */
  text?: string;
  /** type 动作写入的值 */
  value?: string;
  /** 等待毫秒；不填按动作类型取默认值 */
  ms?: number;
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
