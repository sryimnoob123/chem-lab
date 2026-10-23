"use client";

/**
 * components/scene3d/lab-scene.tsx —— 实验室全景（固定视角 = 2.5D 观感）。
 *
 * 和 titration-scene 的区别：那个是「可绕圈的实验特写」，这个是「站在实验室里看自己那张台子」——
 * 相机固定（学生不需要转，也不会转晕），纵深感全靠透视、材质和光影给。
 *
 * 三条硬约束（扣子部署 + 移动端）：
 *   1. 体积：不写死任何大贴图；模型文件放 public/models 且单个 < 400KB，总量 < 2MB。
 *      没有模型时用 vessel-profiles 的旋转体兜底 —— 效果差一点，但绝不白屏。
 *   2. 性能：不开 transmission（要离屏通道）、无后处理、阴影只有一盏方向光、
 *      pixelRatio 封顶 2、document.hidden 时停渲染。
 *   3. 降级：prefers-reduced-motion / WebGL 不可用 → 交给父级回 2D SVG 场景。
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { glassGeometry, graduationRing, liquidGeometry, GLASS_SIZE, type GlassKind } from "./vessel-profiles";
import { labItem } from "@/lib/lab3d/kit";
import styles from "./scene3d.module.css";

export interface LabSceneVessel {
  id: string;
  kind: GlassKind;
  /** 台面坐标：x 横向、z 纵深（米）；y 由台面高度决定 */
  x: number;
  z: number;
  /** 液面 0~1 */
  level?: number;
  /** 液体颜色（走 lib/scene/liquid-mix 的结果） */
  color?: string;
}

export interface LabSceneProps {
  vessels: LabSceneVessel[];
  /** 台面高度（世界单位，1 ≈ 10cm） */
  benchTop?: number;
  label?: string;
}

import { BENCH_SPEC as BENCH } from "@/lib/lab3d/kit";


/**
 * 接地阴影贴图：canvas 画一张径向渐变，替代纯色圆片。
 * 纯色圆片在深色台面上就是一个黑洞；真实接触阴影是「中心深、边缘化开」。
 */
function makeShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(0.45, "rgba(0,0,0,0.28)");
    g.addColorStop(0.78, "rgba(0,0,0,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

/** 器皿与台面的比例：台面已按真实尺寸（1.8 m）建模，器皿按 10 cm 单位 1:1 放置 */
const VESSEL_SCALE_WORLD = 1;

/** 台面沿 z 后移：让台前露出一段地板，画面才有「站在地上」的纵深 */
const BENCH_Z = -1.6;

export function LabScene({ vessels, benchTop = BENCH.top, label }: LabSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    /* ── 渲染器 ─────────────────────────────────────── */
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      // 规则上 effect 里不该同步 setState（会级联渲染）；这里是一次性的失败兜底，
      // 丢到微任务里让 React 在本次渲染结束后再切降级文案。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      queueMicrotask(() => setFailed(true));
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    /* ── 场景与相机（固定视角：略高于台面俯看，像站在实验台前） ── */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    /**
     * 近景俯视（用户 2026-10-23）：聚焦实验桌本体，不再把整间屋子装进画面。
     * 站得太远会看到墙上货架、天花板，反而喧宾夺主；贴近台面才像"站在桌前做实验"。
     */
    /**
     * 游戏式斜俯视（用户 2026-10-23）：45° 左右的等距视角，台面读成一块梯形，
     * 器皿露出「顶 + 侧面」，台前留地板 —— 这是 2.5D 游戏（模拟人生/双点医院）的经典取法。
     * 用长焦（fov 32）压掉透视畸变，物件不会近大远小得夸张。
     */
    camera.position.set(0, benchTop + 11.5, 12.8);
    camera.lookAt(0, benchTop - 0.55, BENCH_Z);

    /* ── 光照：窗外主光 + 顶灯补光 + 环境 ─────────────── */
    const sun = new THREE.DirectionalLight(0xfff6e6, 2.15);
    sun.position.set(-11, 22, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 16;
    sun.shadow.camera.bottom = -16;
    sun.shadow.bias = -0.0012;
    sun.shadow.radius = 2.5;
    scene.add(sun);

    /** 需要手动释放的几何（three 不会自动回收，切场景时必须 dispose） */
    const disposables: { dispose: () => void }[] = [];
    const shadowTexture = makeShadowTexture();
    disposables.push(shadowTexture);

    const fill = new THREE.HemisphereLight(0xf2f6ff, 0xd8d3c8, 1.15);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xdfe9ff, 0.55);
    rim.position.set(11, 12, -8);
    scene.add(rim);

    /**
     * 环境反射（HDRI，CC0 / Poly Haven）。
     * 玻璃的「真不真」全看有没有环境可反射：只有直射光时，玻璃会读成白色塑料。
     * 加载失败就跳过 —— 场景仍旧能看，只是质感弱一点，绝不因此白屏。
     */
    let envTexture: THREE.Texture | null = null;
    let pmrem: THREE.PMREMGenerator | null = null;
    void (async () => {
      try {
        const { RGBELoader } = await import("three/examples/jsm/loaders/RGBELoader.js");
        const hdr = await new RGBELoader().loadAsync("/hdri/art_studio.hdr");
        pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const envMap = pmrem.fromEquirectangular(hdr).texture;
        envTexture = envMap;
        scene.environment = envMap;
        // 环境光强度：太强会把人造光冲淡，0.55 是玻璃有反射、阴影又还在的平衡点
        scene.environmentIntensity = 0.55;
        hdr.dispose();
      } catch {
        /* 没贴图也能跑 */
      }
    })();

    /* ── 房间：后墙 / 地面 / 窗 ──────────────────────── */
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8e9e4, roughness: 0.94, metalness: 0 });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 26), wallMat);
    wall.position.set(0, 13, -9.4);
    wall.receiveShadow = true;
    scene.add(wall);

    const floorMat = new THREE.MeshStandardMaterial({ color: 0xbcc3c0, roughness: 0.9, metalness: 0.02 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 54), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 8);
    floor.receiveShadow = true;
    scene.add(floor);

    /**
     * 地砖缝：网格线比贴图便宜（零下载、零显存），却能把「地面」和「白色虚空」分开 ——
     * 这是玩家判断"站在地上"的主要线索。
     */
    const grid = new THREE.GridHelper(48, 24, 0x9aa3a0, 0xa8b0ad);
    grid.position.set(0, 0.005, 6);
    (grid.material as THREE.Material).opacity = 0.5;
    (grid.material as THREE.Material).transparent = true;
    scene.add(grid);

    /* 窗：一块自发光面 + 窗框，作为「光从哪来」的依据 */
    const paneMat = new THREE.MeshBasicMaterial({ color: 0xfdfcf4 });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(9, 5.4), paneMat);
    pane.position.set(6.5, 13.2, -9.35);
    scene.add(pane);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0xc6cdcb, roughness: 0.6, metalness: 0.15 });
    const frameV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.6, 0.14), frameMat);
    frameV.position.set(6.5, 13.2, -9.32);
    scene.add(frameV);
    const frameH = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.12, 0.14), frameMat);
    frameH.position.set(6.5, 13.2, -9.32);
    scene.add(frameH);

    /* ── 实验台：台身 + 台面 + 挡水板 ────────────────── */
    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0xdfe3df, roughness: 0.72, metalness: 0.03 });
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(BENCH.width, benchTop - BENCH.thickness, BENCH.depth), cabinetMat);
    cabinet.position.set(0, (benchTop - BENCH.thickness) / 2, BENCH_Z);
    cabinet.castShadow = true;
    cabinet.receiveShadow = true;
    scene.add(cabinet);

    const topMat = new THREE.MeshStandardMaterial({ color: 0x39444a, roughness: 0.3, metalness: 0.1 });
    const benchSurface = new THREE.Mesh(
      new THREE.BoxGeometry(BENCH.width + 0.14, BENCH.thickness, BENCH.depth + 0.12),
      topMat,
    );
    benchSurface.position.set(0, benchTop - BENCH.thickness / 2, BENCH_Z);
    benchSurface.castShadow = true;
    benchSurface.receiveShadow = true;
    scene.add(benchSurface);

    /* 后挡水板：给台面一道真实边缘，纵深靠它读出来 */
    const splash = new THREE.Mesh(new THREE.BoxGeometry(BENCH.width + 0.14, 0.26, 0.05), cabinetMat);
    splash.position.set(0, benchTop + 0.1, BENCH_Z - BENCH.depth / 2 - 0.03);
    splash.castShadow = true;
    splash.receiveShadow = true;
    scene.add(splash);

    /* 墙裙：下半段深一号，给墙一个「踢脚」，房间才立得起来 */
    const wainscot = new THREE.Mesh(
      new THREE.BoxGeometry(26, 1.1, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xd2d8d6, roughness: 0.85, metalness: 0.02 }),
    );
    wainscot.position.set(0, 0.55, -8.35);
    wainscot.receiveShadow = true;
    scene.add(wainscot);

    /* 踢脚线高光条 */
    const skirt = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.06, 0.11),
      new THREE.MeshStandardMaterial({ color: 0xb9c1bf, roughness: 0.6, metalness: 0.2 }),
    );
    skirt.position.set(0, 1.1, -8.34);
    scene.add(skirt);

    /* 试剂架：后墙两层 + 架上瓶子（远景，不投影） */
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0xd7dcda, roughness: 0.8, metalness: 0.1 });
    const shelfBottleMats = [0x9dbba6, 0xc0b489, 0xa8b6c9, 0xc9a6a0, 0x9fb6be].map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05 }),
    );
    [3.35, 4.25].forEach((y, shelfIndex) => {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 0.36), shelfMat);
      shelf.position.set(-1.1, y, -8.1);
      shelf.receiveShadow = true;
      scene.add(shelf);
      // 每层 6 个瓶子，用旋转体轮廓做（代码生成，零资源）
      for (let i = 0; i < 6; i += 1) {
        const geo = glassGeometry("reagent");
        disposables.push(geo);
        const bottle = new THREE.Mesh(geo, shelfBottleMats[(i + shelfIndex) % shelfBottleMats.length]);
        const scale = 0.62 + ((i * 37) % 11) / 60;
        bottle.scale.setScalar(scale * 0.55);
        bottle.position.set(-3.3 + i * 0.86, y + 0.03, -8.08);
        scene.add(bottle);
      }
    });

    /* 左侧通风柜：实验室的标志物，也给画面一个「大件」压住构图 */
    const hoodMat = new THREE.MeshStandardMaterial({ color: 0xeceee9, roughness: 0.55, metalness: 0.12 });
    const hoodBody = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.5, 1.1), hoodMat);
    hoodBody.position.set(-6.4, 1.75, -7.6);
    hoodBody.castShadow = true;
    hoodBody.receiveShadow = true;
    scene.add(hoodBody);
    // 柜内深色（打开的那一格）
    const hoodInner = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.5, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x8f9c9e, roughness: 0.7, metalness: 0.1 }),
    );
    hoodInner.position.set(-6.4, 2.35, -7.55);
    scene.add(hoodInner);
    // 柜内两层隔板 + 几只试剂瓶：有内容的柜子才像实验室，不像纸箱
    [2.05, 2.62].forEach((y) => {
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 0.8), shelfMat);
      board.position.set(-6.4, y, -7.55);
      scene.add(board);
      for (let i = 0; i < 3; i += 1) {
        const geo = glassGeometry("reagent");
        disposables.push(geo);
        const jar = new THREE.Mesh(geo, shelfBottleMats[(i + 2) % shelfBottleMats.length]);
        jar.scale.setScalar(0.3);
        jar.position.set(-7.1 + i * 0.62, y + 0.02, -7.5);
        scene.add(jar);
      }
    });
    // 玻璃门
    const hoodDoor = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 1.5),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.06,
        metalness: 0,
        transparent: true,
        opacity: 0.18,
        clearcoat: 1,
        side: THREE.DoubleSide,
      }),
    );
    hoodDoor.position.set(-6.4, 2.35, -7.09);
    scene.add(hoodDoor);

    /* ── 器皿：玻璃壳 + 液体 + 台面阴影 ─────────────── */
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      // 0.16：玻璃要"透"，高了就成白塑料；靠 clearcoat + 环境反射表现厚度
      opacity: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.35,
      side: THREE.DoubleSide,
      depthWrite: false,
      // 不开 transmission：需要离屏通道，低端机上换来的是掉帧而不是好看
      transmission: 0,
    });

    const group = new THREE.Group();
    scene.add(group);

    vessels.forEach((vessel) => {
      const grad = labItem(vessel.kind) ?? { holdsLiquid: true, size: GLASS_SIZE[vessel.kind] };
      const holder = new THREE.Group();
      holder.position.set(vessel.x, benchTop, vessel.z + BENCH_Z);
      /**
       * 器皿整体缩放：GLASS_SIZE 用的是「器皿自己的基准尺寸」，
       * 直接按 1:1 摆到 7.4 宽的台面上会像浴缸（实测直径占台宽 16%）。
       * 真实 250 mL 烧杯直径约 7 cm，台宽约 1.8~2 m，比例 4% 左右 —— 取 0.62 折中，
       * 既符合真实比例，远看又还认得出形状。
       */
      holder.scale.setScalar(VESSEL_SCALE_WORLD);

      const shellGeo = glassGeometry(vessel.kind);
      disposables.push(shellGeo);
      const shell = new THREE.Mesh(shellGeo, glassMat);
      shell.castShadow = true;
      shell.receiveShadow = false;
      holder.add(shell);

      if (vessel.level && vessel.level > 0.02) {
        const { h } = GLASS_SIZE[vessel.kind];
        const liquidGeo = liquidGeometry(vessel.kind, vessel.level);
        disposables.push(liquidGeo);
        const liquidMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(vessel.color ?? "#9fc4e8"),
          roughness: 0.12,
          metalness: 0,
          transparent: true,
          opacity: 0.92,
          // 液体几乎不吃环境反射：一吃就发白像牛奶，溶液应该是「有色但透」的
          envMapIntensity: 0.04,
          // 只渲染外表面：DoubleSide 会让前后壁叠加，颜色被平均成灰白
          side: THREE.FrontSide,
        });
        const liquid = new THREE.Mesh(liquidGeo, liquidMat);
        liquid.position.y = (h * vessel.level) / 2 + 0.06;
        holder.add(liquid);
      }

      /**
       * 刻度线：用细圆环贴在器壁上（零贴图）。
       * 没有刻度，玻璃器皿就只是「透明瓶子」，学生认不出量筒和容量瓶的区别。
       */
      if (grad.holdsLiquid) {
        const { r, h } = GLASS_SIZE[vessel.kind];
        for (let i = 1; i <= 4; i += 1) {
          const geo = graduationRing(vessel.kind);
          disposables.push(geo);
          const ring = new THREE.Mesh(
            geo,
            new THREE.MeshBasicMaterial({ color: 0xdfe8f2, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
          );
          ring.rotation.x = -Math.PI / 2;
          // 贴在壁内侧一点点，避免和玻璃壳 z-fighting
          ring.scale.setScalar(0.99);
          ring.position.y = (h * i) / 5;
          holder.add(ring);
        }
      }

      /**
       * 接地阴影：一块径向渐变的暗贴片。
       * 只靠方向光投影不够——器皿和台面同色调时看不出距离，贴片负责"坐住"。
       */
      const shadowGeo = new THREE.CircleGeometry(GLASS_SIZE[vessel.kind].r * 1.5, 20);
      disposables.push(shadowGeo);
      const shadow = new THREE.Mesh(
        shadowGeo,
        new THREE.MeshBasicMaterial({
          map: shadowTexture,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          blending: THREE.NormalBlending,
        }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(vessel.x, benchTop + 0.003, vessel.z + BENCH_Z);
      scene.add(shadow);

      group.add(holder);
    });

    /* ── 渲染循环（页面隐藏时停） ───────────────────── */
    let raf = 0;
    let running = true;
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const tick = () => {
      if (!running) return;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
      disposables.forEach((d) => d.dispose());
      envTexture?.dispose();
      pmrem?.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [vessels, benchTop]);

  if (failed) {
    return (
      <p className={styles.fallback} data-demo-id="demo-scene-3d-fallback">
        这台设备没能启用图形加速，已切回平面视图。
      </p>
    );
  }

  return (
    <div
      ref={hostRef}
      className={styles.scene3d}
      data-demo-id="demo-scene-3d"
      role="img"
      aria-label={label ?? "实验室：实验台与玻璃器皿"}
    />
  );
}
