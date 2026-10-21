/**
 * components/devtools/devtools-enabled.ts —— 开发调试开关（服务端判断，唯一口径）
 *
 * DEVTOOLS=1/true/on 强制开启；DEVTOOLS=0/false/off 强制关闭；
 * 未设置时仅 `NODE_ENV !== "production"` 开启。
 *
 * 只给服务端组件（layout、/dev）调用；客户端组件不要在渲染里读 DEVTOOLS（不会被内联）。
 */

export function devtoolsEnabled(): boolean {
  const flag = process.env.DEVTOOLS?.trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "on") return true;
  if (flag === "0" || flag === "false" || flag === "off") return false;
  return process.env.NODE_ENV !== "production";
}
