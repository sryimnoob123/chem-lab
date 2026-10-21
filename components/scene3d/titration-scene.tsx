"use client";

/**
 * components/scene3d/titration-scene.tsx —— exp09 滴定场景的 three.js 最小可用试点。
 *
 * 只做四件事：
 * 1. 两个器皿（滴定管 + 锥形瓶），玻璃材质、液体随参数升降（平滑过渡）；
 * 2. 指针拖拽旋转（另给方向键，键盘也能转）；
 * 3. rAF 驱动，`document.hidden` 时停；
 * 4. `prefers-reduced-motion` 下不自动旋转、不做液滴动画、液面直接到位。
 *
 * 刻意不引 @react-three/fiber / drei：本项目"禁引运行时依赖"，three 本体足够。
 * 渲染器透明背景，叠在现有深色实验台上；2D 路径完全不受影响（本组件只被
 * `app/exp/[id]/scene-stage.tsx` 在 `?scene=3d` 时 `next/dynamic(ssr:false)` 加载）。
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

import { FLASK_MOUTH_Y, createVessel, type VesselHandle } from "./vessel-mesh";
import styles from "./scene3d.module.css";

export interface TitrationSceneProps {
  /** 滴定管内剩余液面 0~1（滴定过程中下降） */
  buretteLevel: number;
  /** 锥形瓶内液面 0~1（滴定过程中上升） */
  flaskLevel: number;
  /** 无障碍标签 */
  label?: string;
}

interface Targets {
  current: { buretteLevel: number; flaskLevel: number };
}

interface SceneRefs {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  burette: VesselHandle;
  flask: VesselHandle;
  drop: THREE.Mesh;
  targets: Targets;
  reduceMotion: boolean;
  radius: number;
  theta: number;
  phi: number;
  currentBurette: number;
  currentFlask: number;
  dropProgress: number;
  dropCooldown: number;
  dragging: boolean;
  lastX: number;
  lastY: number;
  rafId: number;
  running: boolean;
  dispose: () => void;
}

const MIN_PHI = 0.55;
const MAX_PHI = 1.42;
const AUTO_ROTATE = 0.12; // rad/s，很慢，用来提示"这是 3D"
const NEAR = 0.1;
const FAR = 100;

export function TitrationScene({ buretteLevel, flaskLevel, label }: TitrationSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const fallbackRef = useRef<HTMLParagraphElement | null>(null);
  const sceneRef = useRef<SceneRefs | null>(null);
  const targetsRef = useRef<Targets["current"]>({ buretteLevel, flaskLevel });

  // 最新 props 在 effect 里同步进 ref（rAF 直接读），避免重建场景
  useEffect(() => {
    targetsRef.current = { buretteLevel, flaskLevel };
  }, [buretteLevel, flaskLevel]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let refs: SceneRefs;
    try {
      refs = buildScene(host, { current: targetsRef.current }, reduceMotionQuery.matches);
    } catch (error) {
      const message = error instanceof Error ? error.message : "WebGL 初始化失败";
      if (fallbackRef.current) {
        fallbackRef.current.hidden = false;
        fallbackRef.current.textContent = `3D 场景不可用（${message}）。去掉地址栏里的 scene=3d 即可回到 2D 场景。`;
      }
      return;
    }
    sceneRef.current = refs;
    host.dataset.ready = "true";

    const onResize = () => {
      const current = sceneRef.current;
      if (!current) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      current.renderer.setSize(width, height, false);
      current.camera.aspect = width / height;
      // 竖屏（手机）下视野更窄，把相机拉远一点，免得滴定管顶端被裁掉
      current.radius = width / height < 1.05 ? 12.4 : 9.4;
      current.camera.updateProjectionMatrix();
    };
    onResize();

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(host);

    const onPointerDown = (event: PointerEvent) => {
      const current = sceneRef.current;
      if (!current) return;
      current.dragging = true;
      current.lastX = event.clientX;
      current.lastY = event.clientY;
      host.setPointerCapture(event.pointerId);
      host.dataset.dragging = "true";
    };
    const onPointerMove = (event: PointerEvent) => {
      const current = sceneRef.current;
      if (!current?.dragging) return;
      current.theta -= (event.clientX - current.lastX) * 0.008;
      current.phi = Math.min(MAX_PHI, Math.max(MIN_PHI, current.phi + (event.clientY - current.lastY) * 0.005));
      current.lastX = event.clientX;
      current.lastY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      const current = sceneRef.current;
      if (!current) return;
      current.dragging = false;
      if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
      delete host.dataset.dragging;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const current = sceneRef.current;
      if (!current) return;
      if (event.key === "ArrowLeft") current.theta += Math.PI / 18;
      else if (event.key === "ArrowRight") current.theta -= Math.PI / 18;
      else if (event.key === "ArrowUp") current.phi = Math.max(MIN_PHI, current.phi - 0.08);
      else if (event.key === "ArrowDown") current.phi = Math.min(MAX_PHI, current.phi + 0.08);
      else return;
      event.preventDefault();
    };
    const onReduceChange = (event: MediaQueryListEvent) => {
      const current = sceneRef.current;
      if (current) current.reduceMotion = event.matches;
    };

    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerUp);
    host.addEventListener("keydown", onKeyDown);
    host.addEventListener("contextmenu", preventDefault);
    reduceMotionQuery.addEventListener("change", onReduceChange);

    const onVisibility = () => {
      const current = sceneRef.current;
      if (!current) return;
      if (document.hidden) stopLoop(current);
      else startLoop(current);
    };
    document.addEventListener("visibilitychange", onVisibility);

    startLoop(refs);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMotionQuery.removeEventListener("change", onReduceChange);
      resizeObserver.disconnect();
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerUp);
      host.removeEventListener("keydown", onKeyDown);
      host.removeEventListener("contextmenu", preventDefault);
      stopLoop(refs);
      refs.dispose();
      sceneRef.current = null;
      host.removeAttribute("data-ready");
    };
  }, []);

  return (
    <div className={styles.scene3d} data-demo-id="demo-scene-3d">
      <div
        ref={hostRef}
        className={styles.canvasHost}
        role="img"
        tabIndex={0}
        aria-label={label ?? "三维滴定场景：拖动或按方向键旋转视角"}
      />
      <p ref={fallbackRef} className={styles.fallback} role="status" data-demo-id="demo-scene-3d-fallback" hidden />
      <p className={styles.badge} aria-hidden="true">
        3D 试点 · 拖拽旋转
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 场景装配
 * ------------------------------------------------------------------ */

function buildScene(host: HTMLDivElement, targets: Targets, reduceMotion: boolean): SceneRefs {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.className = styles.canvas;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, NEAR, FAR);

  const liquidColor = 0xe0778f; // 酚酞终点色系，只承载化学信息

  const flask = createVessel("flask", { liquidColor, level: clamp01(targets.current.flaskLevel, 0.1) });
  flask.object.position.set(0, 0, 0);
  scene.add(flask.object);

  const burette = createVessel("burette", { liquidColor: 0x6fb0e6, level: clamp01(targets.current.buretteLevel, 1) });
  // 管尖在 vessel-mesh 里已按"悬在瓶口上方 0.06"摆好，这里不再整体抬升
  burette.object.position.set(0, 0, 0);
  scene.add(burette.object);

  const benchGeometry = new THREE.CircleGeometry(6, 48);
  const benchMaterial = new THREE.MeshStandardMaterial({ color: 0x223142, roughness: 0.92, metalness: 0 });
  const bench = new THREE.Mesh(benchGeometry, benchMaterial);
  bench.rotation.x = -Math.PI / 2;
  bench.position.y = -0.01;
  scene.add(bench);

  // 一盏右上主光 + 半球环境光（3D 没有环境光就只剩剪影；不是"第二光源"的装饰光）
  const hemi = new THREE.HemisphereLight(0xdfe9f2, 0x141d26, 1.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(5, 8, 6);
  scene.add(key);

  // 液滴：复用同一个小球，滴定过程中从管尖落下
  const dropGeometry = new THREE.SphereGeometry(0.035, 12, 10);
  const dropMaterial = new THREE.MeshStandardMaterial({
    color: liquidColor,
    roughness: 0.3,
    transparent: true,
    opacity: 0.9,
  });
  const drop = new THREE.Mesh(dropGeometry, dropMaterial);
  drop.visible = false;
  scene.add(drop);

  const refs: SceneRefs = {
    renderer,
    scene,
    camera,
    burette,
    flask,
    drop,
    targets,
    reduceMotion,
    radius: 9.4,
    theta: 0.34,
    phi: 1.13,
    currentBurette: clamp01(targets.current.buretteLevel, 1),
    currentFlask: clamp01(targets.current.flaskLevel, 0.1),
    dropProgress: 1,
    dropCooldown: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    rafId: 0,
    running: false,
    dispose: () => {
      dropGeometry.dispose();
      dropMaterial.dispose();
      benchGeometry.dispose();
      benchMaterial.dispose();
      flask.dispose();
      burette.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
  return refs;
}

/* ------------------------------------------------------------------ *
 * rAF 循环
 * ------------------------------------------------------------------ */

function startLoop(refs: SceneRefs): void {
  if (refs.running) return;
  refs.running = true;
  let previous = performance.now();
  const frame = (now: number) => {
    if (!refs.running) return;
    const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
    previous = now;
    tick(refs, dt);
    refs.renderer.render(refs.scene, refs.camera);
    refs.rafId = requestAnimationFrame(frame);
  };
  refs.rafId = requestAnimationFrame(frame);
}

function stopLoop(refs: SceneRefs): void {
  refs.running = false;
  cancelAnimationFrame(refs.rafId);
}

function tick(refs: SceneRefs, dt: number): void {
  const targetBurette = clamp01(refs.targets.current.buretteLevel, 1);
  const targetFlask = clamp01(refs.targets.current.flaskLevel, 0.1);

  // 液面平滑过渡；reduceMotion 下直接到位（不做动画）
  const smooth = refs.reduceMotion ? 1 : Math.min(1, dt * 3.2);
  const previousBurette = refs.currentBurette;
  refs.currentBurette += (targetBurette - refs.currentBurette) * smooth;
  refs.currentFlask += (targetFlask - refs.currentFlask) * smooth;
  const levelDropping = previousBurette - refs.currentBurette > 0.0005;
  refs.burette.setLevel(refs.currentBurette);
  refs.flask.setLevel(refs.currentFlask);

  // 液滴：只在管里液体下降时落、带冷却；reduceMotion 下不落
  refs.dropCooldown = Math.max(0, refs.dropCooldown - dt);
  if (!refs.reduceMotion && levelDropping && refs.dropCooldown <= 0) {
    refs.dropProgress = 0;
    refs.dropCooldown = 0.55;
  }
  if (refs.dropProgress < 1) {
    refs.dropProgress = Math.min(1, refs.dropProgress + dt * 1.9);
    const from = FLASK_MOUTH_Y + 0.06; // 管尖
    const to = FLASK_MOUTH_Y - 0.42; // 落下 0.48 后消失，不穿进瓶身
    refs.drop.position.set(0, from + (to - from) * refs.dropProgress, 0);
    refs.drop.visible = true;
    if (refs.dropProgress >= 1) refs.drop.visible = false;
  }

  // 自动缓慢自转；用户拖拽时暂停
  if (!refs.reduceMotion && !refs.dragging) refs.theta += AUTO_ROTATE * dt;

  const sinPhi = Math.sin(refs.phi);
  refs.camera.position.set(
    refs.radius * sinPhi * Math.sin(refs.theta),
    2.55 + refs.radius * Math.cos(refs.phi),
    refs.radius * sinPhi * Math.cos(refs.theta),
  );
  refs.camera.lookAt(0, 2.45, 0);
}

function clamp01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function preventDefault(event: Event): void {
  event.preventDefault();
}
