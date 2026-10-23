import { expect, test, type Page } from "@playwright/test";

/**
 * A1 回归守卫：拖拽时器皿只放大 1.03，不许叠加到 1.06（用户 2026-10-23「洗槽上方看着偏大」）。
 *
 * 背景：抬起感由内层 `.vesselLift`（scale 1.03）给；外层 `.vessel` 在拖动中由 JS 每帧写 inline
 * translate。CSS 里还有一条 `.vessel[data-drop-hover="valid"] { scale(1.03) }` —— 如果哪天
 * JS 不再写 inline transform（或改成写 scale），两层就会相乘变成 1.06，也就是用户看到的那一幕。
 * 所以断言必须两头都看：内层放大量 ≈1.03，外层不许再带缩放。
 */

const LIFT_SCALE = 1.03;
/** 允许 0.005 的取整误差（getBoundingClientRect 是亚像素，DOMMatrix 也按 float 存） */
const EPS = 0.005;

async function hydrate(page: Page) {
  await page.goto("/exp/exp01?force=1");
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-vessel-id="beaker"]');
      return Boolean(el && Object.keys(el).some((k) => k.startsWith("__react")));
    },
    null,
    { timeout: 20000 },
  );
}

/** 读一帧：内层缩放、外层缩放、内层渲染宽度、外层 inline transform */
const readScale = (page: Page) =>
  page.evaluate(() => {
    const vessel = document.querySelector('[data-vessel-id="beaker"]') as HTMLElement;
    const lift = vessel.querySelector('[class*="vesselLift"]') as HTMLElement;
    const mat = (v: string) => (v && v !== "none" ? new DOMMatrixReadOnly(v) : new DOMMatrixReadOnly());
    const liftM = mat(getComputedStyle(lift).transform);
    const outM = mat(getComputedStyle(vessel).transform);
    return {
      lift: liftM.a,
      outer: outM.a,
      width: lift.getBoundingClientRect().width,
      lifted: vessel.getAttribute("data-lifted"),
      inline: vessel.style.transform,
    };
  });

async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await page.waitForTimeout(16);
  }
}

test("拖到洗槽上方：器皿只放大 1.03，外层不叠加", async ({ page }) => {
  await hydrate(page);

  const beaker = page.locator('[data-vessel-id="beaker"]');
  const sinkBox = (await page.locator('[data-drop-kind="sink"]').first().boundingBox())!;
  const beakerBox = (await beaker.boundingBox())!;
  const before = await readScale(page);
  expect(before.lift, "静止时应是原尺寸").toBeCloseTo(1, 3);
  expect(before.width).toBeGreaterThan(10);

  // 拖到洗槽正上方（松手前量：这一帧就是学生看到的「洗槽上方」）
  await dragTo(
    page,
    { x: beakerBox.x + beakerBox.width / 2, y: beakerBox.y + beakerBox.height / 2 },
    { x: sinkBox.x + sinkBox.width / 2, y: sinkBox.y + sinkBox.height / 2 },
  );
  await page.waitForTimeout(260); // 等 180ms 的抬起过渡跑完

  const during = await readScale(page);
  expect(during.lifted, "拖动中应进入抬起态").toBe("true");

  // ① 内层放大量就是 1.03
  expect(during.lift).toBeGreaterThanOrEqual(LIFT_SCALE - EPS);
  expect(during.lift).toBeLessThanOrEqual(LIFT_SCALE + EPS);

  // ② 外层不许再带缩放（带上了就是 1.03×1.03 = 1.06，肉眼就是用户说的"偏大"）
  expect(during.outer, "外层在拖动中应只剩 translate，不能带 scale").toBeCloseTo(1, 3);
  expect(during.inline).toContain("translate");
  expect(during.inline).not.toContain("scale");

  // ③ 实际渲染宽度只涨 3%（学生看到的是这个数，不是 CSS 里写的）
  const growth = during.width / before.width;
  expect(growth, `实拍放大倍数 ${growth.toFixed(4)}`).toBeGreaterThan(1 + LIFT_SCALE - 1 - EPS);
  expect(growth, `实拍放大倍数 ${growth.toFixed(4)}`).toBeLessThanOrEqual(LIFT_SCALE + EPS);

  await page.mouse.up();
});

test("拖到不收试剂的器皿上方：拒绝提示出来，拖起来的器皿仍是 1.03", async ({ page }) => {
  await hydrate(page);

  const beaker = page.locator('[data-vessel-id="beaker"]');
  const flask = page.locator('[data-vessel-id="flask"]');
  const flaskBox = (await flask.boundingBox())!;
  const beakerBox = (await beaker.boundingBox())!;

  const flaskBefore = await flask.evaluate((el) => {
    const m = getComputedStyle(el).transform;
    return m === "none" ? 1 : new DOMMatrixReadOnly(m).a;
  });
  expect(flaskBefore).toBeCloseTo(1, 3);
  await dragTo(
    page,
    { x: beakerBox.x + beakerBox.width / 2, y: beakerBox.y + beakerBox.height / 2 },
    { x: flaskBox.x + flaskBox.width / 2, y: flaskBox.y + flaskBox.height / 2 },
  );
  await page.waitForTimeout(260);

  // 拖起来的那台：还是 1.03，没有因为压在别的器皿上再变大
  const during = await readScale(page);
  expect(during.lift).toBeLessThanOrEqual(LIFT_SCALE + EPS);
  expect(during.outer).toBeCloseTo(1, 3);

  // 被压的那台：拒绝提示必须已经亮起来（学生松手前就知道这里不能放）
  const target = await flask.evaluate((el) => {
    const badge = el.querySelector('[data-badge="bad"]');
    const m = getComputedStyle(el).transform;
    return {
      drop: el.getAttribute("data-drop"),
      badge: badge ? Number(getComputedStyle(badge).opacity) : 0,
      scale: m === "none" ? 1 : new DOMMatrixReadOnly(m).a,
    };
  });
  expect(target.drop, "第 1 步往锥形瓶里放应判拒绝").toBe("bad");
  expect(target.badge, "拒绝标签应在松手前可见").toBeGreaterThan(0.5);
  expect(target.scale, "被压的那台不该跟着缩放（1×1.03 就是二次放大）").toBeCloseTo(1, 3);

  await page.mouse.up();
});
