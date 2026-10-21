/**
 * 事故特效的公共类型（asset-pipeline 独占），与 `lib/scene/fx.ts` 的 FxKey 一一对应。
 * 组件不读 store、不发请求：给 active 就播，播完回调 onDone。
 */

export type FxScale = "inline" | "full";

export type FxProps = {
  /** 挂载即开始播放；置回 false 由父组件负责卸载或重播。 */
  active: boolean;
  /** 一次性特效播完回调（循环特效如 FxFire 不调用）。 */
  onDone?: () => void;
  /** inline：320×240 居中；full：铺满整个舞台。 */
  scale?: FxScale;
};
