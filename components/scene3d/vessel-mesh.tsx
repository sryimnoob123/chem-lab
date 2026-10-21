/**
 * components/scene3d/vessel-mesh.tsx —— 3D 器皿的几何与材质构造（命令式 three 对象）。
 *
 * 为什么是 .tsx：与 `titration-scene.tsx` 同目录、同一套约定；本文件**不含 JSX**，
 * 只导出构造函数，供 React 组件在 useEffect 里装配（本项目不引 @react-three/fiber）。
 *
 * 设计约定（与 DESIGN-CONTRACT §5 对齐的 3D 投影）：
 * - 玻璃：单层、无实填充，低不透明度 + 低粗糙度；玻璃不写 depthWrite，避免自遮挡闪烁；
 * - 液体：不透明度 .55 左右，液面高度由 `setLevel()` 驱动（0~1）；
 * - 光源：右上 45° 主光 + 半球环境光（3D 需要一点环境光才能看出体积，不是第二光源的装饰光）；
 * - 描边：3D 不描边，靠材质对比；不要让 3D 看起来像 2D SVG 的替代品。
 *
 * 试点只做 exp09 需要的两种器皿（滴定管 / 锥形瓶）；其它器皿按同样接口追加。
 */

import * as THREE from "three";

/** 器皿种类：试点只覆盖滴定管与锥形瓶。 */
export type VesselKind = "burette" | "flask";

export interface VesselOptions {
  /** 液体颜色（十六进制数值），来自 lib/scene/palette 的语义色用法 */
  liquidColor: number;
  /** 初始液面 0~1 */
  level?: number;
}

/** 一个器皿的句柄：拿 Object3D 挂进场景，拿 setLevel 驱动液面，卸载时 dispose。 */
export interface VesselHandle {
  kind: VesselKind;
  object: THREE.Group;
  /** 0 = 空，1 = 满。滴定管语义是"从零刻度往下放液"，见实现注释。 */
  setLevel: (level: number) => void;
  dispose: () => void;
}

const GLASS_TINT = 0xeef5fb;
/** 渲染顺序：玻璃先、液体后，液体才不会被半透明玻璃"洗白"。 */
const RENDER_ORDER = { glass: 1, liquid: 2 } as const;

/** 共享玻璃材质工厂：同一场景内复用一份即可，dispose 由各自 handle 负责。 */
function makeGlassMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: GLASS_TINT,
    metalness: 0,
    roughness: 0.06,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
    // 不开 transmission：它需要额外的离屏渲染通道，颜色越低端机越糊，性价比不值。
    transmission: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.3,
  });
}

function makeLiquidMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.3,
    metalness: 0,
    transparent: true,
    opacity: 0.62,
  });
}

/* ------------------------------------------------------------------ *
 * 滴定管：竖直细管 + 管内液柱 + 活塞 + 尖嘴
 * ------------------------------------------------------------------ */

const BURETTE = {
  radius: 0.075,
  bodyHeight: 3,
  // 管身底部 2.2 → 尖嘴最低点 1.98，刚好悬在锥形瓶口（1.92）上方 0.06
  bodyBottom: 2.2,
  tipHeight: 0.22,
} as const;

function createBurette(options: VesselOptions): VesselHandle {
  const group = new THREE.Group();
  group.name = "burette";

  const glass = makeGlassMaterial();
  const liquidMaterial = makeLiquidMaterial(options.liquidColor);

  const bodyTop = BURETTE.bodyBottom + BURETTE.bodyHeight;
  const bodyCenterY = BURETTE.bodyBottom + BURETTE.bodyHeight / 2;

  const bodyGeometry = new THREE.CylinderGeometry(BURETTE.radius, BURETTE.radius, BURETTE.bodyHeight, 28, 1, true);
  const body = new THREE.Mesh(bodyGeometry, glass);
  body.position.y = bodyCenterY;
  body.renderOrder = RENDER_ORDER.glass;
  group.add(body);

  // 刻度：0.1 mL 细刻线在 3D 里太密（屏幕上一片糊），只画 0.5 mL 主刻度、朝观察者一侧
  const tickPoints: number[] = [];
  const tickCount = 6;
  for (let index = 0; index <= tickCount; index += 1) {
    const y = BURETTE.bodyBottom + (BURETTE.bodyHeight * index) / tickCount;
    const half = 0.62; // 前端 ±60° 弧
    tickPoints.push(
      Math.sin(-half) * BURETTE.radius * 1.01,
      y,
      Math.cos(-half) * BURETTE.radius * 1.01,
      Math.sin(half) * BURETTE.radius * 1.01,
      y,
      Math.cos(half) * BURETTE.radius * 1.01,
    );
  }
  const tickGeometry = new THREE.BufferGeometry();
  tickGeometry.setAttribute("position", new THREE.Float32BufferAttribute(tickPoints, 3));
  const tickMaterial = new THREE.LineBasicMaterial({ color: 0xdfe9f2, transparent: true, opacity: 0.55 });
  const ticks = new THREE.LineSegments(tickGeometry, tickMaterial);
  ticks.renderOrder = RENDER_ORDER.glass;
  group.add(ticks);

  // 上下管口封边（细圆环），只为了关掉"透视看到内部空腔"的廉价感
  const rimGeometry = new THREE.TorusGeometry(BURETTE.radius, 0.011, 8, 28);
  for (const y of [BURETTE.bodyBottom, bodyTop]) {
    const rim = new THREE.Mesh(rimGeometry, glass);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y;
    rim.renderOrder = RENDER_ORDER.glass;
    group.add(rim);
  }

  // 尖嘴：细圆锥，管尖朝下
  const tipGeometry = new THREE.ConeGeometry(BURETTE.radius * 0.62, BURETTE.tipHeight, 16, 1, true);
  const tip = new THREE.Mesh(tipGeometry, glass);
  tip.rotation.x = Math.PI;
  tip.position.y = BURETTE.bodyBottom - BURETTE.tipHeight / 2;
  tip.renderOrder = RENDER_ORDER.glass;
  group.add(tip);

  // 活塞/胶管段：位置正好在尖嘴与管身之间
  const stopcockGeometry = new THREE.CylinderGeometry(BURETTE.radius * 0.72, BURETTE.radius * 0.72, 0.16, 16);
  const stopcockMaterial = new THREE.MeshStandardMaterial({ color: 0x8fa4b8, roughness: 0.6, metalness: 0.1 });
  const stopcock = new THREE.Mesh(stopcockGeometry, stopcockMaterial);
  stopcock.position.y = BURETTE.bodyBottom + 0.02;
  group.add(stopcock);

  // 液柱：整根圆柱，用 scale.y + position.y 表达液面，几何体只建一次
  const liquidGeometry = new THREE.CylinderGeometry(BURETTE.radius * 0.93, BURETTE.radius * 0.93, 1, 24, 1, true);
  const liquid = new THREE.Mesh(liquidGeometry, liquidMaterial);
  liquid.renderOrder = RENDER_ORDER.liquid;
  group.add(liquid);

  const innerTop = bodyTop - 0.02;
  const innerBottom = BURETTE.bodyBottom + 0.06;
  const innerHeight = innerTop - innerBottom;

  const setLevel = (level: number): void => {
    const clamped = Math.min(1, Math.max(0, level));
    // 滴定管是"从上往下放液"：level 表示管内还剩多少，液面顶部固定在零刻度附近
    const h = Math.max(0.001, innerHeight * clamped);
    liquid.scale.y = h;
    liquid.position.y = innerTop - h / 2;
    liquid.visible = clamped > 0.004;
  };
  setLevel(options.level ?? 1);

  return {
    kind: "burette",
    object: group,
    setLevel,
    dispose: () => {
      bodyGeometry.dispose();
      rimGeometry.dispose();
      tipGeometry.dispose();
      stopcockGeometry.dispose();
      liquidGeometry.dispose();
      tickGeometry.dispose();
      glass.dispose();
      liquidMaterial.dispose();
      stopcockMaterial.dispose();
      tickMaterial.dispose();
    },
  };
}

/* ------------------------------------------------------------------ *
 * 锥形瓶：锥形瓶身 + 瓶颈 + 瓶内液体（液面水平，几何按液面重建）
 * ------------------------------------------------------------------ */

const FLASK = {
  bottomRadius: 0.62,
  topRadius: 0.2,
  bodyHeight: 1.5,
  neckRadius: 0.18,
  neckHeight: 0.42,
} as const;

function createFlask(options: VesselOptions): VesselHandle {
  const group = new THREE.Group();
  group.name = "flask";

  const glass = makeGlassMaterial();
  const liquidMaterial = makeLiquidMaterial(options.liquidColor);

  const bodyGeometry = new THREE.CylinderGeometry(
    FLASK.topRadius,
    FLASK.bottomRadius,
    FLASK.bodyHeight,
    32,
    1,
    true,
  );
  const body = new THREE.Mesh(bodyGeometry, glass);
  body.position.y = FLASK.bodyHeight / 2;
  body.renderOrder = RENDER_ORDER.glass;
  group.add(body);

  const neckGeometry = new THREE.CylinderGeometry(
    FLASK.neckRadius,
    FLASK.neckRadius,
    FLASK.neckHeight,
    24,
    1,
    true,
  );
  const neck = new THREE.Mesh(neckGeometry, glass);
  neck.position.y = FLASK.bodyHeight + FLASK.neckHeight / 2;
  neck.renderOrder = RENDER_ORDER.glass;
  group.add(neck);

  const rimGeometry = new THREE.TorusGeometry(FLASK.neckRadius, 0.012, 8, 24);
  const rim = new THREE.Mesh(rimGeometry, glass);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = FLASK.bodyHeight + FLASK.neckHeight;
  rim.renderOrder = RENDER_ORDER.glass;
  group.add(rim);

  // 瓶底：一个薄圆盘，让器皿有"落在台面上"的着地感（3D 不做投影，靠接触面）
  const baseGeometry = new THREE.CylinderGeometry(FLASK.bottomRadius, FLASK.bottomRadius, 0.03, 32);
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x24313f, roughness: 0.85, metalness: 0 });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = 0.015;
  group.add(base);

  // 液面几何：随液面高度重建（锥形瓶侧壁是斜的，缩放会让液体穿出瓶壁）
  let liquidGeometry: THREE.CylinderGeometry | null = null;
  const liquid = new THREE.Mesh(new THREE.BufferGeometry(), liquidMaterial);
  liquid.renderOrder = RENDER_ORDER.liquid;
  group.add(liquid);

  const rebuildLiquid = (clamped: number): void => {
    liquidGeometry?.dispose();
    if (clamped <= 0.004) {
      liquid.visible = false;
      liquidGeometry = null;
      return;
    }
    const h = FLASK.bodyHeight * clamped;
    const ratio = h / FLASK.bodyHeight;
    // 侧壁线性内收：液面处半径为底半径 + (顶半径-底半径)*ratio，留 0.97 余量避免穿模
    const radiusAtLevel = (FLASK.bottomRadius + (FLASK.topRadius - FLASK.bottomRadius) * ratio) * 0.97;
    liquidGeometry = new THREE.CylinderGeometry(radiusAtLevel, FLASK.bottomRadius * 0.97, h, 32, 1, false);
    liquid.geometry = liquidGeometry;
    liquid.position.y = h / 2;
    liquid.visible = true;
  };

  const setLevel = (level: number): void => {
    rebuildLiquid(Math.min(1, Math.max(0, level)));
  };
  setLevel(options.level ?? 0.2);

  return {
    kind: "flask",
    object: group,
    setLevel,
    dispose: () => {
      bodyGeometry.dispose();
      neckGeometry.dispose();
      rimGeometry.dispose();
      baseGeometry.dispose();
      liquidGeometry?.dispose();
      glass.dispose();
      liquidMaterial.dispose();
      baseMaterial.dispose();
    },
  };
}

/** 按种类装配一个器皿。 */
export function createVessel(kind: VesselKind, options: VesselOptions): VesselHandle {
  return kind === "burette" ? createBurette(options) : createFlask(options);
}

/** 滴定管尖嘴的世界坐标 y（液滴从这里落下）。 */
export const BURETTE_TIP_Y = BURETTE.bodyBottom - BURETTE.tipHeight;
/** 滴定管管身顶部 y（相机取景用）。 */
export const BURETTE_TOP_Y = BURETTE.bodyBottom + BURETTE.bodyHeight;
/** 锥形瓶口顶部 y。 */
export const FLASK_MOUTH_Y = FLASK.bodyHeight + FLASK.neckHeight;
