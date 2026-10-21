"use client";

/**
 * ErrorToast —— E3「系统错误」toast（STYLE-20261021 §4.1）。
 *
 * 规格：顶部下滑 240ms（--shake 同档）+ 3.5s 自动收；role="alert"、aria-live="assertive"；
 * 同时最多 1 条（调用方保证只挂一个，本组件本身只渲染一条）；可选 action 按钮 ≥44px。
 *
 * 文案：只收「人话」；如果调用方误传了技术错误原文，sanitizeForStudents 会退回到
 * "这一步没完成，再点一次；还不行就告诉老师"，不把错误码抛给学生。
 * 悬停/聚焦时暂停计时，键盘用户有时间点 action（WCAG 2.2.1）。
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./incident.module.css";
import { sanitizeForStudents } from "./messages";
import { useIsClient } from "./use-is-client";

export interface ErrorToastAction {
  label: string;
  onClick: () => void;
  demoId?: string;
}

export interface ErrorToastProps {
  open: boolean;
  /** 人话一句话（≤30 字）；技术错误码请先用 errorMessage() 分类 */
  message: string;
  /** 可选的第二行补充（同样会过技术泄漏过滤） */
  detail?: string;
  /** 可选动作：重试 / 返回 / 联系老师；触控区 ≥44px */
  action?: ErrorToastAction;
  /** 必填：自动收或点「×」时回调，由调用方置 open=false */
  onDismiss: () => void;
  /** 自动收起时长，默认 3500ms（对应 3.5s） */
  autoHideMs?: number;
  demoId?: string;
}

export function ErrorToast({
  open,
  message,
  detail,
  action,
  onDismiss,
  autoHideMs = 3500,
  demoId,
}: ErrorToastProps) {
  const mounted = useIsClient();
  const [paused, setPaused] = useState(false);
  // 内容变化 = 新一条错误：用 key 重挂 toast 重播下滑动画，并重置 3.5s 计时。
  const shownKey = `${message}|${detail ?? ""}`;

  useEffect(() => {
    if (!open || paused || autoHideMs <= 0) return;
    const timer = window.setTimeout(onDismiss, autoHideMs);
    return () => window.clearTimeout(timer);
  }, [open, paused, autoHideMs, onDismiss, shownKey]);

  const dismiss = () => {
    setPaused(false);
    onDismiss();
  };

  if (!mounted || !open) return null;

  const text = sanitizeForStudents(message);
  const sub = detail ? sanitizeForStudents(detail, "") : "";

  return createPortal(
    <div
      className={styles.toastWrap}
      data-demo-id={demoId}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div
        key={shownKey}
        className={styles.toast}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        data-paused={paused ? "true" : undefined}
      >
        <span className={styles.toastMark} aria-hidden="true" />
        <span className={styles.toastIcon} aria-hidden="true">
          !
        </span>
        <div className={styles.toastBody}>
          <p className={styles.toastText}>{text}</p>
          {sub ? <p className={styles.toastDetail}>{sub}</p> : null}
        </div>
        {action ? (
          <button
            type="button"
            className={`ix ${styles.toastAction}`}
            data-demo-id={action.demoId}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ) : null}
        <button
          type="button"
          className={`ix ${styles.toastClose}`}
          onClick={dismiss}
          aria-label="关闭提示"
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}
