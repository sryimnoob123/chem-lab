/**
 * components/scene3d/apparatus-mesh.tsx —— 3D 器材（天平 / pH 计 / 量筒）几何与材质构造。
 * 与 `vessel-mesh.tsx` 同目录同一套约定；**不含 JSX**，只导出构造函数，供 React 在 useEffect 里装配。
 * 约定：玻璃 MeshPhysicalMaterial（opacity .12 / depthWrite:false / 不开 transmission）；液体 MeshStandardMaterial（opacity .62）；
 * 底部 y=0 贴台面、整件高 1.6~2.4；3D 不描边靠材质对比；读数屏用 MeshBasicMaterial（冷光，但不是光源）。
 */

import * as THREE from "three";

/** 一个器材的句柄：拿 Object3D 挂进场景，卸载时 dispose（几何/材质/贴图全释放）。 */
export interface ApparatusHandle {
  object: THREE.Group;
  /** 只有带液体的器材（量筒）有：0 = 空，1 = 满 */
  setLevel?: (level: number) => void;
  dispose: () => void;
}

/** 天平：默认高 1.78、宽 1.4。 */
export interface BalanceOptions {
  size?: number;
}

/** pH 计：默认高约 1.79。 */
export interface PhMeterOptions {
  size?: number;
}

export interface CylinderOptions {
  /** 液体颜色（十六进制数值），用 lib/scene/palette 的语义色 */
  liquidColor: number;
  /** 初始液面 0~1，默认 0.45 */
  level?: number;
}

const GLASS_TINT = 0xeef5fb;
/** 渲染顺序：玻璃先、液体后，液体才不会被半透明玻璃"洗白"。 */
const RENDER_ORDER = { glass: 1, liquid: 2 } as const;

const makeGlassMaterial = (): THREE.MeshPhysicalMaterial =>
  new THREE.MeshPhysicalMaterial({
    color: GLASS_TINT,
    metalness: 0,
    roughness: 0.06,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
    transmission: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.3,
  });

const makeLiquidMaterial = (color: number): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.62 });

/** 机身：浅灰哑光烤漆（亮场里靠明度差与接触面立住）。 */
const makeBodyMaterial = (): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: 0xd8e0e7, roughness: 0.62, metalness: 0.08 });

/** 深色件：底盘、立柱横臂、按钮。 */
const makeDarkMaterial = (): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color: 0x5b6b7b, roughness: 0.55, metalness: 0.25 });

/** 读数屏：液晶冷光（MeshBasicMaterial，不吃光照、也不照亮别的东西）。 */
const makeScreenMaterial = (): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ color: 0x9fe8f2, toneMapped: false });

/** 一次性释放 group 里的 geometry / material / texture，并从父级摘掉。 */
function disposeGroup(group: THREE.Group): void {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.LineSegments)) return;
    child.geometry?.dispose();
    const materials: THREE.Material[] = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      const slots = material as unknown as Record<string, unknown>;
      for (const key of Object.keys(slots)) {
        const value = slots[key];
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
  group.clear();
  group.removeFromParent();
}

/** 摆一个网格：省掉 position/rotation 样板；几何与材质由调用方复用。 */
function add(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z = 0,
  rotation?: { x?: number; y?: number; z?: number },
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (rotation) mesh.rotation.set(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
  group.add(mesh);
  return mesh;
}

/* ------------------------------------------------------------------ 分析天平 */

const BALANCE = {
  baseWidth: 1.4, baseHeight: 0.2, baseDepth: 0.95,
  columnHeight: 1.58, columnX: -0.52, columnZ: -0.28,
  panRadius: 0.34, panY: 0.62,
} as const;

function createBalance(options: BalanceOptions = {}): ApparatusHandle {
  const group = new THREE.Group();
  group.name = "balance";

  const body = makeBodyMaterial();
  const dark = makeDarkMaterial();
  const screen = makeScreenMaterial();

  add(group, new THREE.BoxGeometry(BALANCE.baseWidth, BALANCE.baseHeight, BALANCE.baseDepth), body, 0, 0.1);
  // 底盘前沿压一条深色腰线：亮场没有影，靠这条线分开"台面 / 机身"
  add(group, new THREE.BoxGeometry(BALANCE.baseWidth * 0.98, 0.05, BALANCE.baseDepth * 0.98), dark, 0, 0.025);
  add(
    group,
    new THREE.BoxGeometry(0.18, BALANCE.columnHeight, 0.18),
    body,
    BALANCE.columnX,
    BALANCE.baseHeight + BALANCE.columnHeight / 2,
    BALANCE.columnZ,
  );
  // 立柱顶端横臂：把视线从立柱引到称盘上方，天平才不像"两根不相干的柱子"
  add(
    group,
    new THREE.BoxGeometry(0.62, 0.1, 0.14),
    dark,
    BALANCE.columnX + 0.3,
    BALANCE.baseHeight + BALANCE.columnHeight - 0.05,
    BALANCE.columnZ,
  );
  add(group, new THREE.CylinderGeometry(BALANCE.panRadius, BALANCE.panRadius, 0.035, 32), body, 0.06, BALANCE.panY);
  add(
    group,
    new THREE.CylinderGeometry(0.05, 0.05, BALANCE.panY - BALANCE.baseHeight, 16),
    dark,
    0.06,
    BALANCE.baseHeight + (BALANCE.panY - BALANCE.baseHeight) / 2,
  );

  // 读数屏：略后仰、正面朝 +z；屏面比边框亮一档，冷光来自材质本身
  add(group, new THREE.BoxGeometry(0.56, 0.26, 0.04), dark, 0, 0.34, 0.46, { x: -0.12 });
  add(group, new THREE.BoxGeometry(0.48, 0.18, 0.02), screen, 0, 0.345, 0.485, { x: -0.12 });
  // 三块"数字"暗条：复用同一几何，不建纹理贴图
  const digitGeometry = new THREE.BoxGeometry(0.075, 0.1, 0.006);
  for (const x of [-0.13, 0, 0.13]) add(group, digitGeometry, dark, x, 0.345, 0.497, { x: -0.12 });

  group.scale.setScalar(options.size ?? 1);
  return { object: group, dispose: () => disposeGroup(group) };
}

/* ------------------------------------------------------------------ pH 计 */

const PH_METER = {
  baseWidth: 0.5, baseHeight: 0.06, bodyWidth: 0.32, bodyDepth: 0.2, bodyHeight: 1.3,
  rodRadius: 0.042, rodLength: 0.62, rodTilt: 0.42, // 相对竖直方向外斜（rad）
  bulbRadius: 0.075,
} as const;

function createPhMeter(options: PhMeterOptions = {}): ApparatusHandle {
  const group = new THREE.Group();
  group.name = "ph-meter";

  const body = makeBodyMaterial();
  const dark = makeDarkMaterial();
  const screen = makeScreenMaterial();

  add(group, new THREE.BoxGeometry(PH_METER.baseWidth, PH_METER.baseHeight, PH_METER.bodyDepth + 0.16), dark, 0, 0.03);
  const bodyBottom = PH_METER.baseHeight;
  add(group, new THREE.BoxGeometry(PH_METER.bodyWidth, PH_METER.bodyHeight, PH_METER.bodyDepth), body, 0, bodyBottom + PH_METER.bodyHeight / 2);
  add(group, new THREE.BoxGeometry(0.22, 0.26, 0.02), screen, 0, bodyBottom + PH_METER.bodyHeight - 0.32, PH_METER.bodyDepth / 2 + 0.01);
  add(group, new THREE.BoxGeometry(0.08, 0.05, 0.02), dark, 0, bodyBottom + PH_METER.bodyHeight - 0.62, PH_METER.bodyDepth / 2 + 0.01);

  // 电极杆：从机身上部斜出去（绕 z 转 -tilt，圆柱默认沿 +y），顶端玻璃球泡
  const rodY = bodyBottom + PH_METER.bodyHeight - 0.22;
  const rodX = PH_METER.bodyWidth / 2 + 0.02;
  const rod = add(group, new THREE.CylinderGeometry(PH_METER.rodRadius, PH_METER.rodRadius, PH_METER.rodLength, 18), dark, 0, 0, 0, {
    z: -PH_METER.rodTilt,
  });
  rod.position.set(
    rodX + (Math.sin(PH_METER.rodTilt) * PH_METER.rodLength) / 2,
    rodY + (Math.cos(PH_METER.rodTilt) * PH_METER.rodLength) / 2,
    0,
  );
  add(
    group,
    new THREE.SphereGeometry(PH_METER.bulbRadius, 24, 16),
    makeGlassMaterial(),
    rodX + Math.sin(PH_METER.rodTilt) * PH_METER.rodLength,
    rodY + Math.cos(PH_METER.rodTilt) * PH_METER.rodLength,
  ).renderOrder = RENDER_ORDER.glass;

  group.scale.setScalar(options.size ?? 1);
  return { object: group, dispose: () => disposeGroup(group) };
}

/* ------------------------------------------------------------------ 量筒 */

const CYLINDER = {
  baseRadius: 0.3, baseHeight: 0.055, radius: 0.17,
  bodyHeight: 1.85, bodyBottom: 0.06, lipRadius: 0.19,
} as const;

function createGraduatedCylinder(options: CylinderOptions): ApparatusHandle {
  const group = new THREE.Group();
  group.name = "graduated-cylinder";

  const glass = makeGlassMaterial();
  const liquidMaterial = makeLiquidMaterial(options.liquidColor);

  add(
    group,
    new THREE.CylinderGeometry(CYLINDER.baseRadius, CYLINDER.baseRadius, CYLINDER.baseHeight, 32),
    new THREE.MeshStandardMaterial({ color: 0x5b6b7b, roughness: 0.7, metalness: 0.15 }),
    0,
    CYLINDER.baseHeight / 2,
  );

  const bodyTop = CYLINDER.bodyBottom + CYLINDER.bodyHeight;
  add(
    group,
    new THREE.CylinderGeometry(CYLINDER.radius, CYLINDER.radius, CYLINDER.bodyHeight, 32, 1, true),
    glass,
    0,
    CYLINDER.bodyBottom + CYLINDER.bodyHeight / 2,
  ).renderOrder = RENDER_ORDER.glass;

  // 上口卷边 + 底部细环：关掉"透视线穿进空腔"的廉价感
  const lipGeometry = new THREE.TorusGeometry(CYLINDER.lipRadius, 0.012, 8, 32);
  for (const y of [bodyTop, CYLINDER.bodyBottom]) {
    add(group, lipGeometry, glass, 0, y, 0, { x: Math.PI / 2 }).renderOrder = RENDER_ORDER.glass;
  }

  // 刻度：只画朝向观察者那一侧（3D 里密刻线只会糊成一片）
  const tickPoints: number[] = [];
  const tickCount = 8;
  for (let index = 0; index <= tickCount; index += 1) {
    const y = CYLINDER.bodyBottom + (CYLINDER.bodyHeight * index) / tickCount;
    const half = Math.PI / 3;
    const r = CYLINDER.radius * 1.01;
    tickPoints.push(Math.sin(-half) * r, y, Math.cos(-half) * r, Math.sin(half) * r, y, Math.cos(half) * r);
  }
  const tickGeometry = new THREE.BufferGeometry();
  tickGeometry.setAttribute("position", new THREE.Float32BufferAttribute(tickPoints, 3));
  const ticks = new THREE.LineSegments(
    tickGeometry,
    new THREE.LineBasicMaterial({ color: 0x4a5768, transparent: true, opacity: 0.5 }),
  );
  ticks.renderOrder = RENDER_ORDER.glass;
  group.add(ticks);

  // 液柱：几何只建一次，靠 scale.y + position.y 表达液面（直筒缩放不会穿模）
  const liquidGeometry = new THREE.CylinderGeometry(CYLINDER.radius * 0.93, CYLINDER.radius * 0.93, 1, 28, 1, false);
  const liquid = new THREE.Mesh(liquidGeometry, liquidMaterial);
  liquid.renderOrder = RENDER_ORDER.liquid;
  group.add(liquid);

  const innerBottom = CYLINDER.bodyBottom + 0.02;
  const innerHeight = CYLINDER.bodyHeight - 0.04;
  const setLevel = (level: number): void => {
    const clamped = Math.min(1, Math.max(0, level));
    const height = Math.max(0.001, innerHeight * clamped);
    liquid.scale.y = height;
    liquid.position.y = innerBottom + height / 2;
    liquid.visible = clamped > 0.004;
  };
  setLevel(options.level ?? 0.45);

  return { object: group, setLevel, dispose: () => disposeGroup(group) };
}

/* ------------------------------------------------------------------ 导出 */

export { createBalance, createPhMeter, createGraduatedCylinder };

/** 天平总高（size=1）。 */
export const BALANCE_TOP_Y = BALANCE.baseHeight + BALANCE.columnHeight;
/** pH 计总高（含顶端球泡）。 */
export const PH_METER_TOP_Y =
  PH_METER.baseHeight + PH_METER.bodyHeight - 0.22 + Math.cos(PH_METER.rodTilt) * PH_METER.rodLength + PH_METER.bulbRadius;
/** 量筒总高。 */
export const CYLINDER_TOP_Y = CYLINDER.bodyBottom + CYLINDER.bodyHeight;
