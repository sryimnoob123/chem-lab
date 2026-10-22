"use client";

/**
 * IdleNudge —— 30 秒没动手就浮出来的一句提示（2026-10-22 演示前）。
 *
 * 为什么不是直接调 askHint()：那个入口会按三级阶梯扣分（L1 −1）。学生只是慢，
 * 没主动要提示，扣分不公平、演示时还会莫名其妙掉分。所以这里给的是**免费**的
 * 方向提示（definition 的 hints.h0 = L1「往哪想」），要更具体再由学生自己按「再具体点」，
 * 那时才走灯泡的三级阶梯、才扣分。
 *
 * 交互：一条浮层，不挡操作区（放在舞台左下角），点「知道了」收起；
 * 动手做任何动作会换 feedbackSeq，父组件下一次渲染就把这一条清掉重计时。
 */

import styles from "./guide.module.css";

export function IdleNudge({
  text,
  actionName,
  onDismiss,
  onAskMore,
  demoId = "demo-idle-nudge",
}: {
  text?: string;
  actionName?: string;
  onDismiss: () => void;
  onAskMore?: () => void;
  demoId?: string;
}) {
  return (
    <div className={styles.nudge} role="status" aria-live="polite" data-demo-id={demoId}>
      <span className={styles.nudgeIcon} aria-hidden="true">
        💡
      </span>
      <p className={styles.nudgeText}>
        {text?.trim() ? text : actionName ? `这一步做的是「${actionName}」` : "先看清这一步要做什么"}
      </p>
      <div className={styles.nudgeActions}>
        <button
          type="button"
          className={styles.nudgeGhost}
          onClick={onDismiss}
          data-demo-id={`${demoId}-dismiss`}
        >
          知道了
        </button>
        {onAskMore ? (
          <button
            type="button"
            className={styles.nudgeSolid}
            onClick={onAskMore}
            data-demo-id={`${demoId}-more`}
          >
            再具体点
          </button>
        ) : null}
      </div>
    </div>
  );
}
