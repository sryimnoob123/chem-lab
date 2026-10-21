"use client";

import { useSyncExternalStore } from "react";
import {
  isMuted,
  playSound,
  setMuted,
  subscribeMuted,
} from "@/lib/audio/engine";
import styles from "./sound-toggle.module.css";

export interface SoundToggleProps {
  /** 覆盖文案时用（默认文案后续可迁到 strings.ts，由 Lead 接线）。 */
  labelOn?: string;
  labelOff?: string;
  className?: string;
}

/**
 * 一键静音开关：默认开启音效，点一下静音并记忆偏好。
 * - `aria-pressed` 表示"当前是否静音"，读屏能直接播报状态；
 * - `<button>` 原生键盘可达（Enter / Space），触控区 44×44；
 * - 静音 → 开启时播一声 tick 作为"已开启"听觉确认。
 */
export function SoundToggle({ labelOn, labelOff, className }: SoundToggleProps) {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);
  const label = muted ? labelOff ?? "音效已关闭，点击开启" : labelOn ?? "音效已开启，点击静音";

  function handleToggle() {
    const next = !muted;
    setMuted(next);
    if (!next) playSound("tick");
  }

  return (
    <button
      type="button"
      className={[styles.toggle, className].filter(Boolean).join(" ")}
      aria-pressed={muted}
      aria-label={label}
      title={label}
      data-demo-id="demo-sound-toggle"
      data-muted={muted ? "true" : "false"}
      onClick={handleToggle}
    >
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
        {muted ? (
          <path d="M16 9.5l4 5M20 9.5l-4 5" />
        ) : (
          <>
            <path d="M16 8.8a4.4 4.4 0 0 1 0 6.4" />
            <path d="M18.6 6.6a7.6 7.6 0 0 1 0 10.8" />
          </>
        )}
      </svg>
      <span className={styles.srOnly}>{label}</span>
    </button>
  );
}
