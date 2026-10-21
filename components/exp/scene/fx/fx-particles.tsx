"use client";

/**
 * 强负反馈 · 一次性 Canvas 粒子（L4 爆炸 / 碎裂专用）
 *
 * - 40~80 个碎片，生命 ~900ms，结束自动 cancel rAF 并从 DOM 卸载；
 * - `document.hidden` 时停 rAF，可见时接着跑（省电、不掉帧）；
 * - `prefers-reduced-motion: reduce` 下不挂载（父层已判断，这里再做一次兜底）。
 */

import { useEffect, useRef } from "react";
import styles from "./fx.module.css";

type ParticleKind = "explosion" | "glassBreak";

type Shard = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  life: number;
  maxLife: number;
  color: string;
};

const PALETTE: Record<ParticleKind, readonly string[]> = {
  explosion: ["#E8B33A", "#D98324", "#C0392B", "#F4F1E8", "#FFFFFF"],
  glassBreak: ["#DCE9F2", "#B7CADB", "#8FA6BA", "#E6EEF7", "#5E7286"],
};

const COUNT = 72;
const LIFE_MS = 900;

function seed(kind: ParticleKind): Shard[] {
  const colors = PALETTE[kind];
  return Array.from({ length: COUNT }, (_, i) => {
    const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.5;
    const speed = (kind === "explosion" ? 260 : 190) * (0.35 + Math.random() * 0.9);
    return {
      x: 0,
      y: 0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      size: 2 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 12,
      life: 0,
      maxLife: 520 + Math.random() * (LIFE_MS - 520),
      color: colors[i % colors.length],
    };
  });
}

export function FxParticles({ kind }: { kind: ParticleKind }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0;
    let start = 0;
    const shards = seed(kind);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start;
      const dt = Math.min(32, now - (start + elapsed)) / 1000 || 0.016;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight * 0.44;

      for (const s of shards) {
        s.life += 16;
        if (s.life > s.maxLife) continue;
        s.vy += 920 * dt;
        s.vx *= 0.994;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot += s.vr * dt;
        const alpha = Math.max(0, 1 - s.life / s.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(cx + s.x, cy + s.y);
        ctx.rotate(s.rot);
        ctx.fillStyle = s.color;
        ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size * 0.72);
        ctx.restore();
      }

      if (elapsed < LIFE_MS) {
        raf = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };

    const startRaf = () => {
      if (document.hidden) return;
      raf = window.requestAnimationFrame(tick);
    };
    const onVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(raf);
      } else if (start === 0 || performance.now() - start < LIFE_MS) {
        startRaf();
      }
    };

    startRaf();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [kind]);

  return <canvas ref={canvasRef} className={styles.particles} data-fx-particles={kind} aria-hidden="true" />;
}
