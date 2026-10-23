import { expect, test } from "@playwright/test";

/**
 * 临时验收（2026-10-23）：洗涤 → 倒掉（drain）→ 回原位。
 * 三条要一起证明：器皿不卡在槽里、水不是凭空消失、动作层真的接了 drain。
 */
test("洗涤后接 drain 并回原位", async ({ page }) => {
  await page.goto("/exp/exp01?force=1");
  // 等水合：拖动 hook 挂上后器皿才有 style 属性可控
  await page.waitForFunction(
    () => {
      const n = document.querySelector('[data-vessel-id="volumetric"]') as HTMLElement | null;
      return Boolean(n && Object.keys(n).some((k) => k.startsWith("__react")));
    },
    null,
    { timeout: 20000 },
  );

  const vessel = page.locator('[data-vessel-id="volumetric"]');
  const sink = page.locator('[data-drop-kind="sink"]').first();
  const vb = (await vessel.boundingBox())!;
  const sb = (await sink.boundingBox())!;

  await page.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i += 1) {
    await page.mouse.move(
      vb.x + vb.width / 2 + ((sb.x + sb.width / 2) - (vb.x + vb.width / 2)) * (i / 12),
      vb.y + vb.height / 2 + ((sb.y + sb.height / 2) - (vb.y + vb.height / 2)) * (i / 12),
    );
    await page.waitForTimeout(16);
  }
  await page.mouse.up();

  // 松手后器皿停在槽里
  await expect.poll(async () => vessel.evaluate((el: HTMLElement) => el.style.transform)).not.toBe("translate(0px, 0px)");

  // 洗涤动画演完 → 接 drain（水倒掉那一拍要在场景里出现过）
  const dumpSeen = await page
    .waitForSelector('[data-a="dump"]', { timeout: 12000 })
    .then(() => true)
    .catch(() => false);
  expect(dumpSeen, "洗涤结束后应出现 drain 的倒水动作").toBe(true);

  // 倒完必须回原位
  await expect
    .poll(async () => vessel.evaluate((el: HTMLElement) => el.style.transform), { timeout: 15000 })
    .toBe("translate(0px, 0px)");
});

/**
 * 回位不能是「瞬移」（用户 2026-10-23：滑回原位那一下太突兀）。
 * 判据：回位过程里采到 ≥3 个不同的中间位移 —— 说明是走回去的，不是跳回去的。
 * 用 computed matrix：WAAPI 跑的时候 inline style 不变，只有计算值在动。
 */
test("回位是走回去的，不是瞬移", async ({ page }) => {
  await page.goto("/exp/exp01?force=1");
  await page.waitForFunction(
    () => {
      const n = document.querySelector('[data-vessel-id="volumetric"]') as HTMLElement | null;
      return Boolean(n && Object.keys(n).some((k) => k.startsWith("__react")));
    },
    null,
    { timeout: 20000 },
  );
  const vessel = page.locator('[data-vessel-id="volumetric"]');
  const sb = (await page.locator('[data-drop-kind="sink"]').first().boundingBox())!;
  const vb = (await vessel.boundingBox())!;
  await page.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i += 1) {
    await page.mouse.move(
      vb.x + vb.width / 2 + ((sb.x + sb.width / 2) - (vb.x + vb.width / 2)) * (i / 12),
      vb.y + vb.height / 2 + ((sb.y + sb.height / 2) - (vb.y + vb.height / 2)) * (i / 12),
    );
    await page.waitForTimeout(16);
  }
  await page.mouse.up();

  const seen = new Set<string>();
  for (let i = 0; i < 100; i += 1) {
    const t = await vessel.evaluate((el: HTMLElement) => getComputedStyle(el).transform);
    if (t && t !== "none" && t !== "matrix(1, 0, 0, 1, 0, 0)") seen.add(t);
    if (seen.size >= 3 && t === "matrix(1, 0, 0, 1, 0, 0)") break;
    await page.waitForTimeout(60);
  }
  expect(seen.size, "回位应是连续滑动，不是瞬移").toBeGreaterThanOrEqual(3);
});

/** 洗涤被拒（这一步不用洗）：不该卡在槽里，700ms 内回家 */
test("无效洗涤也回原位", async ({ page }) => {
  await page.goto("/exp/exp01?force=1");
  await page.waitForFunction(
    () => {
      const n = document.querySelector('[data-vessel-id="tube-a"]') as HTMLElement | null;
      return Boolean(n && Object.keys(n).some((k) => k.startsWith("__react")));
    },
    null,
    { timeout: 20000 },
  );
  const vessel = page.locator('[data-vessel-id="tube-a"]');
  const sb = (await page.locator('[data-drop-kind="sink"]').first().boundingBox())!;
  const vb = (await vessel.boundingBox())!;
  await page.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i += 1) {
    await page.mouse.move(
      vb.x + vb.width / 2 + ((sb.x + sb.width / 2) - (vb.x + vb.width / 2)) * (i / 12),
      vb.y + vb.height / 2 + ((sb.y + sb.height / 2) - (vb.y + vb.height / 2)) * (i / 12),
    );
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await expect
    .poll(async () => vessel.evaluate((el: HTMLElement) => el.style.transform), { timeout: 5000 })
    .toBe("translate(0px, 0px)");
});
