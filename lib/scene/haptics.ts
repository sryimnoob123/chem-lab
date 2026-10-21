/**
 * 触感反馈（asset-pipeline）：真机轻微振动，桌面无副作用。
 * 只有移动端浏览器实现了 navigator.vibrate，且常被系统设置忽略——失败也不影响流程。
 */
export function tapFeedback(ms = 8): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(ms);
    }
  } catch {
    /* 忽略：不支持振动的环境 */
  }
}
